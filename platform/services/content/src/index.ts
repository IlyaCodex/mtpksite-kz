/**
 * Контент-сервис: страницы, стили, редиректы, «Наличие», «Сравнение».
 * Источник правды — PostgreSQL (схема content), горячие данные — в Redis.
 */
import { activeHoliday } from '@mtpk/content-model';
import { CONTENT_STREAM, consumeEvents, createLogger, createRedis, JsonCache, startService } from '@mtpk/shared';
import { createDb } from './db.ts';
import { env } from './env.ts';
import { ContentStore } from './store.ts';
import { adminRoutes, publicRoutes } from './routes.ts';

const log = createLogger('content');
const { db, close } = createDb(env.DATABASE_URL, { max: 10, appName: 'content' });
const redis = createRedis(env.REDIS_URL);
// Версия формата PageDto в префиксе ключей: после смены контракта старые записи
// кеша просто не читаются (поднимать при изменении packages/shared/src/contracts.ts).
const CACHE_PREFIX = 'content:dto3';
const cache = new JsonCache(redis, CACHE_PREFIX, (err) => log.warn({ err }, 'redis недоступен — работаем без кеша'));
const store = new ContentStore(db, cache, env.SITE_URL, env.CONTENT_CACHE_TTL, log);
// Запуск — после выкладки или пересборки: страницы прежней версии кода (разметка, адреса стилей
// и скриптов) из кеша не отдаём — каждая собирается заново по первому запросу
log.info({ keys: await store.purge() }, 'кеш страниц сброшен при запуске');

/** Сигнал сайту: перегенерировать изменённые страницы (ISR Next.js). */
async function notifyWeb(paths: string[] | 'all' | 'dictionaries'): Promise<void> {
  if (!env.WEB_URL || !env.REVALIDATE_SECRET) return;
  try {
    await fetch(`${env.WEB_URL}/api/revalidate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-revalidate-secret': env.REVALIDATE_SECRET },
      body: JSON.stringify(paths === 'dictionaries' ? { dictionaries: true } : paths === 'all' ? { all: true, dictionaries: true } : { paths }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'сайт не принял сигнал ревалидации');
  }
}

const abort = new AbortController();
await startService({
  name: 'content',
  description: 'Страницы (блоки), настройки сайта, редиректы, наличие, сравнение. Публичное API /v1 — для сайта и поиска; служебное /admin/v1 — для админки (заголовок X-Admin-Token).',
  port: env.CONTENT_PORT,
  logger: log,
  bodyLimit: 20 * 1024 * 1024, // страницы с крупными стилями весят сотни КБ
  async setup(app) {
    const deps = { store, db, redis, log, adminToken: env.ADMIN_TOKEN, notifyWeb };
    await app.register(publicRoutes, deps);
    await app.register(adminRoutes, deps);
  },
  async readiness() {
    await db.$queryRaw`select 1`;
    await redis.ping();
  },
  async onClose() {
    abort.abort();
    redis.disconnect();
    await close();
  },
});

// Праздничная шапка главной включается и выключается по расписанию («Праздники»): раз в
// полминуты сверяем, какой праздник должен быть на сайте, и при смене — сигнал сайту
// перегенерировать главную (страховка — revalidate у главной до ближайшей смены).
let shownHoliday: string | null | undefined;
const holidayTimer = setInterval(() => {
  void (async () => {
    try {
      const id = activeHoliday(await store.holidays(), Date.now())?.id ?? null;
      if (id !== shownHoliday) {
        if (shownHoliday !== undefined) log.info({ from: shownHoliday, to: id }, 'праздничная шапка главной сменилась');
        shownHoliday = id;
        await notifyWeb(['/']);
      }
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'не удалось проверить расписание праздников');
    }
  })();
}, 30_000);
holidayTimer.unref();

// Массовое изменение контента (событие content.reindex) — сбрасываем весь кеш, даже если
// отправитель не достучался до HTTP-эндпоинта.
const consumer = createRedis(env.REDIS_URL);
void consumeEvents({
  redis: consumer,
  stream: CONTENT_STREAM,
  group: 'content-cache',
  consumer: `content-${process.pid}`,
  logger: log,
  signal: abort.signal,
  async handler(event) {
    if (event.type === 'content.reindex') {
      const removed = await store.purge();
      log.info({ removed }, 'кеш сброшен после импорта');
    }
  },
});
