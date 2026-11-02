/**
 * Поисковый сервис — замена Pagefind. Индекс в PostgreSQL (схема search,
 * tsvector с русской морфологией + триграммы по заголовку), горячие запросы
 * кешируются в Redis. Индекс наполняется событиями контент-сервиса.
 */
import crypto from 'node:crypto';
import { z } from 'zod';
import { LOCALES } from '@mtpk/content-kit/locale';
import {
  CONTENT_STREAM,
  consumeEvents,
  createLogger,
  createRedis,
  envParts,
  isAuthorized,
  JsonCache,
  readEnv,
  startService,
  type SearchResponse,
  type ZodTypeProvider,
} from '@mtpk/shared';
import { createDb } from '@mtpk/db';

const env = readEnv(
  z.object({
    ...envParts.base,
    ...envParts.db,
    ...envParts.redis,
    ...envParts.admin,
    SEARCH_PORT: z.coerce.number().default(4103),
    CONTENT_URL: z.string().default('http://127.0.0.1:4101'),
  }),
);

const log = createLogger('search');
const { db, close } = createDb(env.DATABASE_URL, { max: 5, appName: 'search' });
const redis = createRedis(env.REDIS_URL);
const cache = new JsonCache(redis, 'search:v1', (err) => log.warn({ err }, 'redis недоступен — поиск без кеша'));

interface SearchDoc {
  path: string;
  title: string;
  body: string;
  image: string | null;
  weight: number;
}

/** Записать документы (tsv база вычисляет сама). Пачками по 200 — по транзакции на пачку. */
async function upsert(docs: SearchDoc[]) {
  for (let i = 0; i < docs.length; i += 200) {
    await db.$transaction(
      docs.slice(i, i + 200).map(({ path, ...doc }) =>
        db.searchDocument.upsert({ where: { path }, create: { path, ...doc }, update: doc }),
      ),
    );
  }
}

/** Полная пересборка индекса по данным контент-сервиса. */
async function reindexAll(): Promise<number> {
  const res = await fetch(`${env.CONTENT_URL}/v1/search-docs`);
  if (!res.ok) throw new Error(`контент-сервис ответил ${res.status}`);
  const docs = (await res.text())
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as SearchDoc);
  await upsert(docs);
  const keep = docs.map((d) => d.path);
  if (keep.length) await db.searchDocument.deleteMany({ where: { path: { notIn: keep } } });
  await cache.clear();
  log.info({ documents: docs.length }, 'индекс пересобран');
  return docs.length;
}

/** Одна страница на всех языках: в индексе адреса с приставкой языка. */
async function reindexOne(pagePath: string): Promise<void> {
  for (const locale of LOCALES) {
    const path = `/${locale}${pagePath}`;
    const res = await fetch(`${env.CONTENT_URL}/v1/search-docs/by-path?path=${encodeURIComponent(path)}`);
    if (res.status === 404) await db.searchDocument.deleteMany({ where: { path } });
    else if (res.ok) await upsert([(await res.json()) as SearchDoc]);
    else throw new Error(`контент-сервис ответил ${res.status}`);
  }
  await cache.clear();
}

// ── Запрос ────────────────────────────────────────────────────────────────

/** Слова запроса: буквы/цифры, дефис внутри слова сохраняется (модели вида УИД-376). */
function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/ё/g, 'е')
    .split(/[^\p{L}\p{N}-]+/u)
    .map((t) => t.replace(/^-+|-+$/g, ''))
    .filter((t) => t.length >= 1)
    .slice(0, 8);
}

/** tsquery «все слова, последнее — по префиксу»: поиск по мере набора, как в Pagefind. */
function toTsQuery(words: string[]): string {
  return words
    .flatMap((w) => w.split('-').filter(Boolean))
    .map((w) => `${w.replace(/[^\p{L}\p{N}]/gu, '')}:*`)
    .filter((w) => w.length > 2)
    .join(' & ');
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function search(q: string, limit: number, locale: string): Promise<SearchResponse> {
  const words = tokens(q);
  const tsq = toTsQuery(words);
  if (!tsq) return { query: q, total: 0, results: [] };
  const phrase = q.trim().replace(/[\u2010\u2011\u2012]/g, '-');
  const like = `%${phrase.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  // запрос целым словом в заголовке: «УИД-376» не должен уступать «УИД-376Е»
  const word = `(^|[^[:alnum:]])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^[:alnum:]]|$)`;
  // Ранжирование: релевантность текста × вес страницы (разделы каталога ×10);
  // запрос целиком в заголовке (код модели «УИД-376») — сразу наверх.
  const rows = await db.$queryRaw<{ path: string; title: string; image: string | null; excerpt: string; total: bigint }[]>`
    with q as (select to_tsquery('russian', ${tsq}) as tsq)
    select d.path, d.title, d.image,
      ts_headline('russian', d.body, q.tsq,
        'StartSel=' || chr(1) || ', StopSel=' || chr(2) || ', MaxWords=28, MinWords=12, ShortWord=2, MaxFragments=1') as excerpt,
      count(*) over() as total
    from search.documents d, q
    where d.path like ${`/${locale}/%`} and (d.tsv @@ q.tsq or d.title ilike ${like})
    order by ts_rank_cd(d.tsv, q.tsq, 32) * d.weight
      + case when d.title ilike ${like} then 20 else 0 end
      + case when d.title ~* ${word} then 20 else 0 end desc, d.title
    limit ${limit}
  `;
  const results = rows.map((r) => ({
    url: r.path,
    title: r.title,
    image: r.image,
    excerpt: escapeHtml(r.excerpt).replace(/\u0001/g, '<mark>').replace(/\u0002/g, '</mark>'),
  }));
  return { query: q, total: Number(rows[0]?.total ?? 0), results };
}

// ── HTTP ──────────────────────────────────────────────────────────────────

const abort = new AbortController();
await startService({
  name: 'search',
  description: 'Полнотекстовый поиск по сайту (PostgreSQL, русская морфология). Индекс обновляется по событиям контент-сервиса.',
  port: env.SEARCH_PORT,
  logger: log,
  async setup(base) {
    const app = base.withTypeProvider<ZodTypeProvider>();
    const searchQuery = z.object({
      q: z.string().max(200).default('').describe('Запрос'),
      limit: z.coerce.number().int().min(1).max(50).default(40),
      locale: z.enum(LOCALES).default('ru').describe('Язык страницы'),
    });
    app.get('/api/search', { schema: { tags: ['Поиск'], summary: 'Поиск по сайту', querystring: searchQuery } }, async (req, reply) => {
      const { q, limit, locale } = req.query;
      const key = crypto.createHash('sha1').update(`${q.trim().toLowerCase()}|${limit}|${locale}`).digest('hex');
      reply.header('Cache-Control', 'no-store');
      return cache.wrap(`q:${key}`, 600, () => search(q, limit, locale));
    });
    app.post(
      '/admin/v1/reindex',
      {
        schema: { tags: ['Админка: поиск'], summary: 'Переиндексировать весь сайт', security: [{ adminToken: [] }] },
        onRequest: async (req, reply) => {
          if (!isAuthorized(req.headers as Record<string, unknown>, env.ADMIN_TOKEN)) return reply.code(401).send({ error: 'unauthorized' });
        },
      },
      async () => ({ ok: true, documents: await reindexAll() }),
    );
    app.get(
      '/admin/v1/stats',
      {
        schema: { tags: ['Админка: поиск'], summary: 'Сколько страниц в индексе', security: [{ adminToken: [] }] },
        onRequest: async (req, reply) => {
          if (!isAuthorized(req.headers as Record<string, unknown>, env.ADMIN_TOKEN)) return reply.code(401).send({ error: 'unauthorized' });
        },
      },
      async () => {
        const agg = await db.searchDocument.aggregate({ _count: { _all: true }, _max: { updatedAt: true } });
        return { documents: agg._count._all, updatedAt: agg._max.updatedAt };
      },
    );
  },
  async readiness() {
    await db.$queryRaw`select 1`;
  },
  async onClose() {
    abort.abort();
    redis.disconnect();
    await close();
  },
});

// Пустой индекс (первый запуск) — собрать сразу; дальше — по событиям контента.
if ((await db.searchDocument.count()) === 0) {
  reindexAll().catch((err) => log.error({ err }, 'первичная индексация не удалась — повторится по событию'));
}

void consumeEvents({
  redis: createRedis(env.REDIS_URL),
  stream: CONTENT_STREAM,
  group: 'search-index',
  consumer: `search-${process.pid}`,
  logger: log,
  signal: abort.signal,
  async handler(event) {
    if (event.type === 'content.reindex') await reindexAll();
    else if (event.type === 'page.upserted' || event.type === 'page.deleted') await reindexOne(event.path);
  },
});


