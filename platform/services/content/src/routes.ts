import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CONTENT_STREAM, isAuthorized, publishEvent, type Logger, type Redis, type ZodTypeProvider } from '@mtpk/shared';
import { classifyStyleBlock, detectTemplate, hasStockBlocks, normalizePath, resolveStockBlocks } from '@mtpk/content-kit';
import { sectionParts } from '@mtpk/content-kit/section';
import { cssFileRecord } from '@mtpk/content-kit/styles';
import { formatHtml } from '@mtpk/content-kit/format-html';
import { buttonDesignAttrs } from '@mtpk/content-kit/design';
import { extractBlocksInlineStyles, rulesToCss } from '@mtpk/content-kit/inline-styles';
import { resolveCatalogBlocks } from '@mtpk/content-kit/catalog';
import { annotateDocument, setDocMeta } from '@mtpk/content-kit/doc-edit';
import { responsiveHeroCss } from '@mtpk/content-kit/hero-css';
import {
  block as blockSchema,
  BLOCK_LABELS,
  BLOCK_SCHEMAS,
  holiday as holidaySchema,
  holidaySettings,
  nearestWindow,
  pageHasLeadgen,
  pageInput,
  siteSettings,
  toActiveHoliday,
  walkBlocks,
  type Block,
  type PageInput,
} from '@mtpk/content-model';
import { renderBlocksMarked, renderBlocksToHtml, renderFormSlots } from '@mtpk/ui/server';
import { catalogNodes } from './catalog.ts';
import { catalogAdminRoutes, catalogPageGuard } from './catalog-admin.ts';
import { catalogDependents, loadCatalog } from './catalog-data.ts';
import { orNotFound, Prisma, type Db } from './db.ts';
import { scriptJs, storeScripts } from './scripts.ts';
import type { ContentStore } from './store.ts';

interface Deps {
  store: ContentStore;
  db: Db;
  redis: Redis;
  log: Logger;
  adminToken: string;
  notifyWeb: (paths: string[] | 'all') => Promise<void>;
}

const pathQuery = z.object({ path: z.string().min(1).max(2048).describe('Адрес страницы: /products/…/') });
const idParam = z.object({ id: z.coerce.number().int().positive() });
const ADMIN = [{ adminToken: [] }];

/** Публичное API контента (для сайта и поиска): только чтение. */
export async function publicRoutes(base: FastifyInstance, { store, db }: Deps) {
  const app = base.withTypeProvider<ZodTypeProvider>();

  app.get(
    '/v1/pages/by-path',
    { schema: { tags: ['Страницы'], summary: 'Страница по адресу: SEO, стили, блоки', querystring: pathQuery } },
    async (req, reply) => {
      const page = await store.getPage(req.query.path);
      if (!page) return reply.code(404).send({ error: 'not_found', path: req.query.path });
      return page;
    },
  );
  app.get('/v1/pages', { schema: { tags: ['Страницы'], summary: 'Опубликованные страницы (для карты сайта)' } }, async () => store.listPages());
  app.get('/v1/settings', { schema: { tags: ['Сайт'], summary: 'Настройки сайта: контакты, меню, подвал' } }, async () => store.siteSettings());
  app.get('/v1/holidays', { schema: { tags: ['Сайт'], summary: 'Праздничные баннеры главной: расписание, баннеры, поздравления' } }, async () => store.holidays());
  app.get('/v1/site-data', { schema: { tags: ['Сайт'], summary: 'Склад и разделы со сравнением (для рендера блоков)' } }, async () =>
    store.siteData(),
  );
  app.get('/v1/redirects', { schema: { tags: ['Редиректы'], summary: 'Все редиректы' } }, async () => store.listRedirects());
  // словарь большой, но запрашивается редко: сайт держит его в памяти (apps/web/src/lib/content.ts)
  app.get(
    '/v1/translations/:locale',
    { schema: { tags: ['Сайт'], summary: 'Словарь языка: русская строка → перевод', params: z.object({ locale: z.enum(['kz', 'en']) }) } },
    async (req) => Object.fromEntries((await db.translation.findMany({ where: { locale: req.params.locale }, select: { source: true, target: true } })).map((t) => [t.source, t.target])),
  );

  // Совместимые адреса старой статики: /data/*.json и вынесенные стили.
  const nocache = { 'Cache-Control': 'no-cache, must-revalidate' };
  app.get('/v1/data/stock.json', { schema: { tags: ['Сайт'], summary: 'Наличие на складе (/data/stock.json)' } }, async (_req, reply) =>
    reply.headers(nocache).send(await store.stock()),
  );
  app.get('/v1/data/compare-index.json', { schema: { tags: ['Сайт'], summary: 'Характеристики для сравнения' } }, async (_req, reply) =>
    reply.headers(nocache).send((await store.compare()).index),
  );
  app.get('/v1/data/compare-sections.json', { schema: { tags: ['Сайт'], summary: 'Разделы со сравнением' } }, async (_req, reply) =>
    reply.headers(nocache).send((await store.compare()).sections),
  );
  app.get(
    '/v1/styles/:file',
    { schema: { tags: ['Сайт'], summary: 'Крупный CSS страницы', params: z.object({ file: z.string() }) } },
    async (req, reply) => {
      const m = req.params.file.match(/^inline-(i?[a-f0-9]{12})\.css$/);
      const css = m ? await store.styleCss(m[1]) : null;
      if (!css) return reply.code(404).type('text/plain').send('not found');
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      // фото обложки — телефонам копией 828 px (hero-css.ts; ревизия правил — в адресе ?r=)
      return reply.type('text/css; charset=utf-8').send(responsiveHeroCss(css));
    },
  );
  app.get(
    '/v1/scripts/:file',
    { schema: { tags: ['Сайт'], summary: 'Скрипт блока «Скрипт» (/js/page/<хеш>.js)', params: z.object({ file: z.string() }) } },
    async (req, reply) => {
      const m = req.params.file.match(/^([a-f0-9]{12}).js$/);
      const js = m ? await scriptJs(db, m[1]) : null;
      if (js === null) return reply.code(404).type('text/plain').send('not found');
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      return reply.type('text/javascript; charset=utf-8').send(js);
    },
  );

  // Документы для поискового сервиса
  app.get(
    '/v1/search-docs/by-path',
    { schema: { tags: ['Поиск'], summary: 'Документ страницы для индекса', querystring: pathQuery } },
    async (req, reply) => {
      const doc = await store.searchDoc(req.query.path);
      if (!doc) return reply.code(404).send({ error: 'not_indexable', path: req.query.path });
      return doc;
    },
  );
  app.get('/v1/search-docs', { schema: { tags: ['Поиск'], summary: 'Все документы для индекса (NDJSON)' } }, async (_req, reply) => {
    const lines: string[] = [];
    for await (const doc of store.searchDocs()) lines.push(JSON.stringify(doc));
    return reply.type('application/x-ndjson; charset=utf-8').send(`${lines.join('\n')}\n`);
  });
}

/** Сколько содержимого страницы редактируется формами, а сколько осталось «HTML как есть». */
function blockStats(blocks: Block[]) {
  const all = [...walkBlocks(blocks)].filter((b) => b.type !== 'container' && b.type !== 'text');
  return { blocks: all.length, htmlBlocks: all.filter((b) => b.type === 'html').length };
}

const listQuery = z.object({
  search: z.string().max(200).optional().describe('Поиск по адресу и заголовку'),
  template: z.string().max(1000).optional().describe('Тип страницы; несколько — через запятую'),
  kind: z.enum(['page', 'document']).optional(),
  status: z.enum(['published', 'draft']).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

const redirectInput = z.object({
  from: z.string().min(1).startsWith('/').describe('Откуда: /old-url/'),
  to: z.string().min(1).describe('Куда'),
  code: z.union([z.literal(301), z.literal(302), z.literal(308)]).default(301),
  comment: z.string().max(500).optional(),
});

const stockInput = z
  .object({
    groups: z
      .array(
        z.object({
          key: z
            .string()
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'метка типа — латиница, цифры и дефисы')
            .max(80)
            .describe('Метка в адресе фильтра /nalichie/?type=…'),
          kind: z.enum(['equipment', 'parts']).describe('Раздел: оборудование или запчасти и расходники'),
          title: z.string().trim().min(1).max(200).describe('Название типа'),
          image: z.string().nullable().optional().describe('Фото карточки (нет — фото первой позиции)'),
        }),
      )
      .describe('Типы позиций — в порядке показа'),
    items: z
      .array(
        z.object({
          group: z.string().nullable().optional().describe('Тип (метка)'),
          url: z.string().default('').describe('Страница товара или раздела; пусто — без ссылки'),
          qty: z.number().int().min(0).nullable().optional(),
          shipping: z.string().nullable().optional().describe('Срок отгрузки'),
          price: z.number().int().min(0).nullable().optional().describe('Цена, ₽ (нет — «по запросу»)'),
          priceFrom: z.boolean().optional().describe('«от» перед ценой'),
          priceNote: z.string().max(80).nullable().optional().describe('Пояснение к цене: «с НДС»'),
          note: z.string().nullable().optional().describe('Примечание для себя (на сайт не выводится)'),
          title: z.string().nullable().optional().describe('Название (нет — из каталога)'),
          image: z.string().nullable().optional().describe('Фото (нет — из каталога)'),
          specs: z.array(z.tuple([z.string(), z.string()])).nullable().optional().describe('Характеристики (нет — из каталога)'),
          photos: z
            .array(z.object({ src: z.string().min(1), alt: z.string().default('') }))
            .default([])
            .describe('Фото со склада'),
          hidden: z.boolean().optional().describe('Скрыта на сайте (остаётся в админке)'),
          extra: z.record(z.string(), z.unknown()).optional().describe('Прочие поля позиции (сохраняются как есть)'),
        }),
      )
      .describe('Позиции — в порядке показа'),
  })
  .superRefine((v, ctx) => {
    const keys = new Set<string>();
    v.groups.forEach((g, i) => {
      if (keys.has(g.key)) ctx.addIssue({ code: 'custom', path: ['groups', i, 'key'], message: `метка «${g.key}» уже есть у другого типа` });
      keys.add(g.key);
    });
    v.items.forEach((it, i) => {
      if (it.group && !keys.has(it.group)) ctx.addIssue({ code: 'custom', path: ['items', i, 'group'], message: `нет типа «${it.group}»` });
      if (it.url && !it.url.startsWith('/')) ctx.addIssue({ code: 'custom', path: ['items', i, 'url'], message: 'ссылка — адрес страницы сайта: /products/…/' });
      if (!it.url && !it.title?.trim()) ctx.addIssue({ code: 'custom', path: ['items', i, 'title'], message: 'у позиции без ссылки нужно название' });
    });
  });

/** Служебное API для админки (через её сервер; снаружи шлюзом не открыто). */
export async function adminRoutes(base: FastifyInstance, deps: Deps) {
  const { store, db, redis, adminToken, notifyWeb } = deps;
  const app = base.withTypeProvider<ZodTypeProvider>();
  app.addHook('onRequest', async (req, reply) => {
    if (!isAuthorized(req.headers as Record<string, unknown>, adminToken)) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  });

  const changed = async (changedPaths: string[], kind: 'page.upserted' | 'page.deleted' = 'page.upserted') => {
    // товар или раздел каталога — его название и фото есть и в блоках склада (главная, /nalichie/)
    const paths = changedPaths.some((p) => p.startsWith('/products/')) ? [...new Set([...changedPaths, ...(await store.stockPages())])] : changedPaths;
    // lastmod в sitemap — по факту: правка товара в каталоге меняет его страницу и списки, где видна карточка
    // (поисковики верят lastmod, пока он совпадает с изменениями). Страницы склада — только сброс кеша:
    // товар мог там и не показываться
    if (kind === 'page.upserted') await db.page.updateMany({ where: { path: { in: changedPaths } }, data: { lastmodAt: new Date() } });
    await store.purge(paths);
    for (const path of paths) await publishEvent(redis, CONTENT_STREAM, { type: kind, path });
    await notifyWeb(paths);
  };

  // ── Каталог: категории, подкатегории, товары ───────────────────────────
  await catalogAdminRoutes(app, {
    db,
    store,
    changed,
    purgeAll: async () => {
      await store.purge();
      await notifyWeb('all');
    },
  });

  // ── Схемы блоков: по ним админка строит формы редактирования ──────────
  app.get(
    '/admin/v1/block-schemas',
    { schema: { tags: ['Админка: страницы'], summary: 'JSON-схемы блоков и настроек (формы редактора)', security: ADMIN } },
    async () => ({
      blocks: Object.fromEntries(
        Object.entries(BLOCK_SCHEMAS)
          .filter(([type]) => type !== 'container')
          .map(([type, schema]) => [
            type,
            { label: BLOCK_LABELS[type as Block['type']], schema: z.toJSONSchema(schema, { unrepresentable: 'any', io: 'input' }) },
          ]),
      ),
      settings: z.toJSONSchema(siteSettings, { unrepresentable: 'any', io: 'input' }),
    }),
  );

  // ── Страницы ───────────────────────────────────────────────────────────
  app.get(
    '/admin/v1/pages',
    { schema: { tags: ['Админка: страницы'], summary: 'Список страниц с фильтрами', querystring: listQuery, security: ADMIN } },
    async (req) => {
      const q = req.query;
      const where: Prisma.PageWhereInput = {
        ...(q.search
          ? { OR: [{ path: { contains: q.search, mode: 'insensitive' } }, { title: { contains: q.search, mode: 'insensitive' } }] }
          : {}),
        ...(q.template ? { template: { in: q.template.split(',') } } : {}),
        ...(q.kind ? { kind: q.kind } : {}),
        ...(q.status ? { status: q.status } : {}),
      };
      const [total, rows] = await Promise.all([
        db.page.count({ where }),
        db.page.findMany({
          where,
          select: {
            id: true,
            path: true,
            title: true,
            kind: true,
            template: true,
            status: true,
            noindex: true,
            blocks: true,
            extraMeta: true,
            updatedAt: true,
          },
          orderBy: { path: 'asc' },
          skip: q.offset,
          take: q.limit,
        }),
      ]);
      return {
        total,
        items: rows.map(({ blocks, extraMeta, ...r }) => ({
          ...r,
          source: String((extraMeta as Record<string, unknown>)?.source ?? ''),
          ...blockStats(blocks as Block[]),
        })),
      };
    },
  );

  app.get(
    '/admin/v1/stats',
    { schema: { tags: ['Админка: страницы'], summary: 'Сводка: страницы, блоки, правки в админке', security: ADMIN } },
    async () => {
      const rows = await db.page.findMany({ select: { kind: true, status: true, blocks: true, extraMeta: true } });
      const byType: Record<string, number> = {};
      let blocks = 0;
      let htmlBlocks = 0;
      for (const r of rows) {
        for (const b of walkBlocks(r.blocks as Block[])) {
          if (b.type === 'container' || b.type === 'text') continue;
          blocks++;
          if (b.type === 'html') htmlBlocks++;
          byType[b.type] = (byType[b.type] ?? 0) + 1;
        }
      }
      return {
        pages: rows.filter((r) => r.kind === 'page').length,
        documents: rows.filter((r) => r.kind === 'document').length,
        drafts: rows.filter((r) => r.status === 'draft').length,
        editedInAdmin: rows.filter((r) => (r.extraMeta as Record<string, unknown>)?.source === 'admin').length,
        blocks,
        htmlBlocks,
        byType,
        redirects: await db.redirect.count(),
        stock: await db.stockItem.count(),
      };
    },
  );

  app.get(
    '/admin/v1/catalog',
    { schema: { tags: ['Админка: страницы'], summary: 'Каталог продукции: страницы /products/… с названием, фото и статусом', security: ADMIN } },
    async () => catalogNodes(db),
  );

  app.get(
    '/admin/v1/pages/templates',
    { schema: { tags: ['Админка: страницы'], summary: 'Типы страниц и их количество', security: ADMIN } },
    async () =>
      (await db.page.groupBy({ by: ['template'], _count: { _all: true }, orderBy: { _count: { template: 'desc' } } })).map((r) => ({
        template: r.template,
        count: r._count._all,
      })),
  );

  app.get(
    '/admin/v1/pages/lookup',
    { schema: { tags: ['Админка: страницы'], summary: 'Страница по адресу — для панели администратора на сайте', querystring: pathQuery, security: ADMIN } },
    async (req, reply) => {
      const path = req.query.path.endsWith('.html') ? req.query.path : normalizePath(req.query.path);
      const found = await db.page.findUnique({
        where: { path },
        select: {
          id: true,
          path: true,
          title: true,
          description: true,
          noindex: true,
          status: true,
          kind: true,
          updatedAt: true,
          category: { select: { id: true, name: true } },
          subcategory: { select: { id: true, name: true, categoryId: true } },
          product: { select: { id: true, name: true, categoryId: true, subcategoryId: true } },
        },
      });
      if (!found) return reply.code(404).send({ error: 'not_found', path });
      const { category, subcategory, product, ...page } = found;
      const catalog = category
        ? { kind: 'category' as const, id: category.id, name: category.name, categoryId: category.id }
        : subcategory
          ? { kind: 'subcategory' as const, id: subcategory.id, name: subcategory.name, categoryId: subcategory.categoryId }
          : product
            ? { kind: 'product' as const, id: product.id, name: product.name, categoryId: product.categoryId, subcategoryId: product.subcategoryId }
            : null;
      return { ...page, catalog };
    },
  );

  app.get(
    '/admin/v1/pages/:id',
    { schema: { tags: ['Админка: страницы'], summary: 'Страница для редактирования', params: idParam, security: ADMIN } },
    async (req, reply) => {
      const found = await db.page.findUnique({
        where: { id: req.params.id },
        include: { category: { select: { id: true } }, subcategory: { select: { id: true } }, product: { select: { id: true } } },
      });
      if (!found) return reply.code(404).send({ error: 'not_found' });
      const { category, subcategory, product, ...row } = found;
      // страница каталога: её карточка (категории, подкатегории, товара) правится в разделе «Каталог»
      const catalog = category ? { kind: 'category', id: category.id } : subcategory ? { kind: 'subcategory', id: subcategory.id } : product ? { kind: 'product', id: product.id } : null;
      const styles = row.styleHashes.length
        ? await db.styleBlock.findMany({ where: { hash: { in: row.styleHashes } } })
        : [];
      const byHash = new Map(styles.map((s) => [s.hash, s]));
      // body у обычных страниц — архив исходного HTML, в редактор не отдаём
      const { body, ...page } = row;
      return {
        ...page,
        catalog,
        body: row.kind === 'document' ? body : undefined,
        inlineStyles: row.styleHashes.flatMap((h) => {
          const s = byHash.get(h);
          return s ? [s.css] : [];
        }),
      };
    },
  );

  const savePage = async (input: PageInput, id?: number) => {
    const path = input.path.endsWith('.html') ? input.path : normalizePath(input.path);
    const styleRows = input.inlineStyles
      .filter((b) => b.trim())
      .map((css) => classifyStyleBlock(css.trim().startsWith('<style') ? css : `<style>${css}</style>`));
    // style="" в HTML-блоках → классы, их CSS — файлом стилей страницы (последним)
    const { blocks, rules } = extractBlocksInlineStyles(input.blocks);
    // скрипты — собрать до записи страницы: ошибка в коде — отказ, страница не меняется
    await storeScripts(db, blocks);
    if (rules.size) styleRows.push(classifyStyleBlock(`<style>${rulesToCss(rules)}</style>`));
    // CSS блоков «Стили» и свой CSS HTML-секций — тоже файлами (сайт подключает их ссылкой по хешу)
    const blockCss = [...walkBlocks(blocks)].flatMap((b) => {
      if (b.type === 'style') return [cssFileRecord(b.css)];
      const own = b.type === 'html' ? sectionParts(b) : null;
      return own?.css ? [cssFileRecord(own.css)] : [];
    });
    if (styleRows.length || blockCss.length) await db.styleBlock.createMany({ data: [...styleRows, ...blockCss], skipDuplicates: true });
    const now = new Date();
    const values = {
      path,
      kind: 'page',
      template: input.template ?? detectTemplate(path, ''),
      title: input.title,
      description: input.description ?? null,
      blocks: blocks as Prisma.InputJsonValue,
      cssTemplates: input.cssTemplates,
      styleHashes: styleRows.map((s) => s.hash),
      preloadImage: input.preloadImage ?? null,
      noindex: input.noindex,
      status: input.status,
      lastmodAt: now,
      modifiedAt: now,
      sourceHash: `admin:${now.getTime()}`,
      updatedAt: now,
    };
    if (id) {
      const prev = await db.page.findUnique({ where: { id }, select: { path: true, extraMeta: true } });
      if (!prev) return null;
      // правка в админке — отметка для сводки «Изменено в админке»
      const extraMeta = { ...(prev.extraMeta as Record<string, unknown>), source: 'admin' };
      await db.page.update({ where: { id }, data: { ...values, extraMeta } });
      return { id, paths: prev.path === path ? [path] : [prev.path, path] };
    }
    const row = await db.page.create({ data: { ...values, publishedAt: now, extraMeta: { source: 'admin' } }, select: { id: true } });
    return { id: row.id, paths: [path] };
  };

  app.post(
    '/admin/v1/pages',
    { schema: { tags: ['Админка: страницы'], summary: 'Создать страницу', body: pageInput, security: ADMIN } },
    async (req, reply) => {
      const dup = await db.page.findUnique({ where: { path: normalizePath(req.body.path) }, select: { id: true } });
      if (dup) return reply.code(409).send({ error: 'path_exists', id: dup.id });
      const res = (await savePage(req.body))!;
      await changed(res.paths);
      return reply.code(201).send({ ok: true, id: res.id });
    },
  );

  app.put(
    '/admin/v1/pages/:id',
    { schema: { tags: ['Админка: страницы'], summary: 'Сохранить страницу', params: idParam, body: pageInput, security: ADMIN } },
    async (req, reply) => {
      const dup = await db.page.findUnique({ where: { path: normalizePath(req.body.path) }, select: { id: true } });
      if (dup && dup.id !== req.params.id) return reply.code(409).send({ error: 'path_exists', id: dup.id });
      // страница каталога: адрес раздела с товарами не меняется, старый адрес товара — редиректом
      await catalogPageGuard(db, req.params.id, normalizePath(req.body.path));
      // её карточка видна в списках — их кеш тоже сбрасывается (статус и адрес входят в карточку)
      const before = catalogDependents(await loadCatalog(db), req.params.id);
      const res = await savePage(req.body, req.params.id);
      if (!res) return reply.code(404).send({ error: 'not_found' });
      const after = catalogDependents(await loadCatalog(db), req.params.id);
      await changed([...new Set([...res.paths, ...before, ...after])]);
      return { ok: true, id: req.params.id };
    },
  );

  // ── Страницы-документы (Практикум: целый HTML-документ) ────────────────
  const documentInput = z.object({
    title: z.string().trim().min(1).max(300).describe('Заголовок (title)'),
    description: z.string().trim().max(1000).nullable().optional().describe('Описание (description)'),
    noindex: z.boolean().describe('Скрыть от поисковиков'),
    status: z.enum(['published', 'draft']),
    body: z.string().min(1).describe('HTML-документ целиком'),
  });
  app.post(
    '/admin/v1/documents',
    {
      schema: {
        tags: ['Админка: страницы'],
        summary: 'Создать страницу-документ (новая статья Практикума): HTML целиком; заголовок, описание и noindex — и в его <head>',
        body: documentInput.extend({
          path: z.string().trim().min(2).startsWith('/').describe('Адрес: /praktikum/…/ (рабочий лист — …/имя.html)'),
          template: z.string().trim().min(1).max(40).default('praktikum').describe('Тип: praktikum — статья, praktikum-sheet — лист для печати'),
        }),
        security: ADMIN,
      },
    },
    async (req, reply) => {
      const path = req.body.path.endsWith('.html') ? req.body.path : normalizePath(req.body.path);
      const dup = await db.page.findUnique({ where: { path }, select: { id: true } });
      if (dup) return reply.code(409).send({ error: 'path_exists', id: dup.id });
      const { title, description = null, noindex, status, template } = req.body;
      const body = setDocMeta(req.body.body, { title, description, noindex });
      const now = new Date();
      const row = await db.page.create({
        data: {
          path,
          kind: 'document',
          template,
          title,
          description: description || null,
          noindex,
          status,
          body,
          publishedAt: now,
          modifiedAt: now,
          lastmodAt: now,
          sourceHash: `admin:${now.getTime()}`,
          // в поиск по сайту — текст из <main data-pagefind-body>, как у статей со старого сайта
          extraMeta: { source: 'admin', pagefindBody: /\sdata-pagefind-body[\s=>]/.test(body) },
        },
        select: { id: true },
      });
      await changed([path]);
      return reply.code(201).send({ ok: true, id: row.id, path });
    },
  );

  app.put(
    '/admin/v1/documents/:id',
    {
      schema: {
        tags: ['Админка: страницы'],
        summary: 'Сохранить страницу-документ (Практикум): HTML целиком; заголовок, описание и noindex — и в его <head>',
        params: idParam,
        body: documentInput,
        security: ADMIN,
      },
    },
    async (req, reply) => {
      const row = await db.page.findUnique({ where: { id: req.params.id }, select: { path: true, kind: true, extraMeta: true } });
      if (!row) return reply.code(404).send({ error: 'not_found' });
      if (row.kind !== 'document') return reply.code(409).send({ error: 'not_document', message: 'Это обычная страница — она сохраняется редактором страниц' });
      const { title, description = null, noindex, status } = req.body;
      // документ отдаётся как есть: его <title>, description и robots — в нём самом
      const body = setDocMeta(req.body.body, { title, description, noindex });
      const now = new Date();
      await db.page.update({
        where: { id: req.params.id },
        data: {
          title,
          description: description || null,
          noindex,
          status,
          body,
          modifiedAt: now,
          lastmodAt: now,
          sourceHash: `admin:${now.getTime()}`,
          extraMeta: { ...(row.extraMeta as Record<string, unknown>), source: 'admin' },
        },
      });
      await changed([row.path]);
      return { ok: true, id: req.params.id, path: row.path, title, body };
    },
  );

  app.post(
    '/admin/v1/documents/preview',
    {
      schema: {
        tags: ['Админка: страницы'],
        summary: 'Предпросмотр страницы-документа для правки щелчком: элементы помечены местом в исходнике, формы — как на сайте',
        body: z.object({ body: z.string() }),
        security: ADMIN,
      },
    },
    async (req) => ({ html: renderFormSlots(annotateDocument(req.body.body)) }),
  );

  app.delete(
    '/admin/v1/pages/:id',
    { schema: { tags: ['Админка: страницы'], summary: 'Удалить страницу', params: idParam, security: ADMIN } },
    async (req, reply) => {
      const owner = await db.page.findUnique({ where: { id: req.params.id }, select: { category: true, subcategory: true, product: true } });
      if (owner && (owner.category || owner.subcategory || owner.product)) {
        return reply.code(409).send({ error: 'in_catalog', message: 'Это страница каталога — удалите её в разделе «Каталог продукции»' });
      }
      const row = await orNotFound(db.page.delete({ where: { id: req.params.id }, select: { path: true } }));
      if (!row) return reply.code(404).send({ error: 'not_found' });
      await changed([row.path], 'page.deleted');
      return { ok: true };
    },
  );

  app.post(
    '/admin/v1/render',
    {
      schema: {
        tags: ['Админка: страницы'],
        summary: 'Отрисовать блоки в HTML (предпросмотр в редакторе)',
        body: z.object({
          path: z.string().default('/'),
          blocks: z.array(z.unknown()),
          pretty: z.boolean().optional().describe('С отступами — для правки кодом'),
          mark: z.boolean().optional().describe('С метками блоков <!--mtpk:N--> — для правки текста в предпросмотре'),
          holiday: holidaySchema.optional().describe('Праздник для предпросмотра обложки главной (раздел «Праздники»)'),
          signature: z.string().optional().describe('Подпись под поздравлением'),
        }),
        security: ADMIN,
      },
    },
    async (req) => {
      // как на сайте: карточки из каталога, у товара — общие блоки категории.
      // Метка — номер блока в странице: блоки, добавленные каталогом, её не получают.
      const MARK = '__mtpk';
      // как при сохранении: схема блока подставляет значения по умолчанию (несохранённый черновик их ещё не получил)
      const own = (req.body.blocks as unknown[]).map((raw, i) => {
        const parsed = blockSchema.safeParse(raw);
        const b = (parsed.success ? parsed.data : raw) as Block;
        return req.body.mark ? ({ ...b, [MARK]: String(i) } as unknown as Block) : b;
      });
      const page = await db.page.findUnique({ where: { path: normalizePath(req.body.path) }, select: { id: true } });
      const fromCatalog = page ? resolveCatalogBlocks(page, own, await store.catalog()) : own;
      // блоки склада — с типами и позициями из раздела «Наличие на складе»
      const resolved = hasStockBlocks(fromCatalog) ? resolveStockBlocks(fromCatalog, await store.stockView()) : fromCatalog;
      const marks = resolved.map((b) => ((b as Record<string, unknown>)[MARK] as string | undefined) ?? null);
      const blocks = req.body.mark ? resolved.map((b) => Object.fromEntries(Object.entries(b).filter(([k]) => k !== MARK)) as Block) : resolved;
      const site = await store.siteData();
      const ctx = {
        path: req.body.path,
        stock: site.stock,
        compareSections: site.compareSections,
        hasLeadgenBlock: pageHasLeadgen(blocks),
        // предпросмотр: CSS блоков и секций — сразу в разметке
        preview: Boolean(req.body.mark),
        // предпросмотр праздника в админке — как в его ближайшее окно показа
        holiday: req.body.holiday
          ? toActiveHoliday(req.body.holiday, nearestWindow(req.body.holiday, Date.now()), req.body.signature ?? (await store.holidays()).signature)
          : null,
      };
      const html = req.body.mark ? renderBlocksMarked(blocks, marks, ctx) : renderBlocksToHtml(blocks, ctx);
      // оформление кнопок из настроек сайта — атрибуты <html> документа предпросмотра (как на сайте)
      const htmlAttrs = buttonDesignAttrs((await store.settings()).design);
      return { html: req.body.pretty ? formatHtml(html) : html, htmlAttrs };
    },
  );

  // ── Настройки сайта ────────────────────────────────────────────────────
  app.get(
    '/admin/v1/settings',
    { schema: { tags: ['Админка: настройки'], summary: 'Настройки сайта', security: ADMIN } },
    async () => store.settings(),
  );
  app.put(
    '/admin/v1/settings',
    { schema: { tags: ['Админка: настройки'], summary: 'Сохранить настройки сайта', body: siteSettings, security: ADMIN } },
    async (req) => {
      const by = typeof req.headers['x-admin-user'] === 'string' ? req.headers['x-admin-user'] : null;
      const value = req.body as Prisma.InputJsonValue;
      await db.setting.upsert({ where: { key: 'site' }, create: { key: 'site', value, updatedBy: by }, update: { value, updatedBy: by } });
      // шапка и подвал есть на каждой странице
      await store.purge();
      await notifyWeb('all');
      return { ok: true };
    },
  );

  // ── Праздничные баннеры главной ────────────────────────────────────────
  app.get(
    '/admin/v1/holidays',
    { schema: { tags: ['Админка: настройки'], summary: 'Праздники: расписание, баннеры, поздравления', security: ADMIN } },
    async () => store.holidays(),
  );
  app.put(
    '/admin/v1/holidays',
    { schema: { tags: ['Админка: настройки'], summary: 'Сохранить праздники', body: holidaySettings, security: ADMIN } },
    async (req) => {
      const by = typeof req.headers['x-admin-user'] === 'string' ? req.headers['x-admin-user'] : null;
      const value = req.body as Prisma.InputJsonValue;
      await db.setting.upsert({ where: { key: 'holidays' }, create: { key: 'holidays', value, updatedBy: by }, update: { value, updatedBy: by } });
      await store.purgeHolidays();
      // праздничная шапка — только на главной
      await notifyWeb(['/']);
      return { ok: true };
    },
  );

  // ── Редиректы ──────────────────────────────────────────────────────────
  const redirectQuery = z.object({
    search: z.string().optional(),
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(500).default(100),
  });
  app.get(
    '/admin/v1/redirects',
    { schema: { tags: ['Админка: редиректы'], summary: 'Редиректы', querystring: redirectQuery, security: ADMIN } },
    async (req) => {
      const q = req.query;
      const where: Prisma.RedirectWhereInput = q.search
        ? { OR: [{ fromPath: { contains: q.search, mode: 'insensitive' } }, { toPath: { contains: q.search, mode: 'insensitive' } }] }
        : {};
      const [total, items] = await Promise.all([
        db.redirect.count({ where }),
        db.redirect.findMany({ where, orderBy: { fromPath: 'asc' }, skip: q.offset, take: q.limit }),
      ]);
      return { total, items };
    },
  );
  app.post(
    '/admin/v1/redirects',
    { schema: { tags: ['Админка: редиректы'], summary: 'Добавить (или заменить) редирект', body: redirectInput, security: ADMIN } },
    async (req, reply) => {
      const r = req.body;
      const row = await db.redirect.upsert({
        where: { fromPath: r.from },
        create: { fromPath: r.from, toPath: r.to, code: r.code, source: 'manual', comment: r.comment },
        update: { toPath: r.to, code: r.code, comment: r.comment },
      });
      await store.purgeRedirects();
      return reply.code(201).send(row);
    },
  );
  app.put(
    '/admin/v1/redirects/:id',
    { schema: { tags: ['Админка: редиректы'], summary: 'Изменить редирект', params: idParam, body: redirectInput, security: ADMIN } },
    async (req, reply) => {
      const r = req.body;
      const row = await orNotFound(
        db.redirect.update({ where: { id: req.params.id }, data: { fromPath: r.from, toPath: r.to, code: r.code, comment: r.comment } }),
      );
      if (!row) return reply.code(404).send({ error: 'not_found' });
      await store.purgeRedirects();
      return row;
    },
  );
  app.delete(
    '/admin/v1/redirects/:id',
    { schema: { tags: ['Админка: редиректы'], summary: 'Удалить редирект', params: idParam, security: ADMIN } },
    async (req, reply) => {
      const row = await orNotFound(db.redirect.delete({ where: { id: req.params.id }, select: { id: true } }));
      if (!row) return reply.code(404).send({ error: 'not_found' });
      await store.purgeRedirects();
      return { ok: true };
    },
  );

  // ── Наличие на складе ──────────────────────────────────────────────────
  app.get(
    '/admin/v1/stock',
    { schema: { tags: ['Админка: наличие'], summary: 'Типы и позиции склада', security: ADMIN } },
    async () => {
      const [groups, items] = await Promise.all([
        db.stockGroup.findMany({ orderBy: [{ position: 'asc' }, { id: 'asc' }] }),
        db.stockItem.findMany({ orderBy: [{ position: 'asc' }, { id: 'asc' }] }),
      ]);
      // как позицию покажет сайт: название и фото (свои или из каталога, со страницы запчасти)
      const previews = await store.stockPreviews(items);
      return {
        groups: groups.map((g) => ({ key: g.key, kind: g.kind, title: g.title, image: g.image })),
        items: items.map(({ groupKey, createdAt: _c, updatedAt: _u, id: _id, position: _p, ...it }, i) => ({ ...it, group: groupKey, preview: previews[i] })),
      };
    },
  );
  app.put(
    '/admin/v1/stock',
    {
      schema: {
        tags: ['Админка: наличие'],
        summary: 'Сохранить склад целиком: типы и позиции (в порядке показа)',
        body: stockInput,
        security: ADMIN,
      },
    },
    async (req) => {
      const { groups, items } = req.body;
      // что видно за пределами страниц склада: бейдж «В наличии» (по адресу товара) и срок отгрузки на странице товара —
      // у позиций, которые показываются на сайте
      const outside = (rows: { url: string; shipping?: string | null; hidden?: boolean }[]) =>
        rows
          .filter((r) => !r.hidden)
          .map((r) => `${r.url.trim()}|${r.shipping?.trim() ?? ''}`)
          .sort()
          .join('\n');
      // цена позиции видна и на странице товара (цена в карточке, разметка Product): адрес → цены его позиций
      type PriceRow = { url: string; hidden?: boolean; price?: number | null; priceFrom?: boolean; priceNote?: string | null };
      const prices = (rows: PriceRow[]) => {
        const map = new Map<string, string[]>();
        for (const r of rows.filter((x) => !x.hidden && x.price)) {
          const url = r.url.trim();
          map.set(url, [...(map.get(url) ?? []), `${r.price}|${r.priceFrom ? 1 : 0}|${r.priceNote?.trim() ?? ''}`]);
        }
        return new Map([...map].map(([url, list]) => [url, list.sort().join(';')]));
      };
      const old = await db.stockItem.findMany({ select: { url: true, shipping: true, hidden: true, price: true, priceFrom: true, priceNote: true } });
      const before = outside(old);
      const pricesBefore = prices(old);
      await db.$transaction([
        db.stockItem.deleteMany(),
        db.stockGroup.deleteMany(),
        db.stockGroup.createMany({
          data: groups.map((g, i) => ({ position: i, key: g.key, kind: g.kind, title: g.title.trim(), image: g.image?.trim() || null })),
        }),
        db.stockItem.createMany({
          data: items.map((it, i) => ({
            position: i,
            groupKey: it.group || null,
            url: it.url.trim(),
            qty: it.qty ?? null,
            shipping: it.shipping?.trim() || null,
            price: it.price || null,
            priceFrom: Boolean(it.price && it.priceFrom),
            priceNote: it.price ? it.priceNote?.trim() || null : null,
            note: it.note?.trim() || null,
            title: it.title?.trim() || null,
            image: it.image?.trim() || null,
            specs: it.specs?.length ? it.specs : Prisma.DbNull,
            photos: it.photos as Prisma.InputJsonValue,
            hidden: it.hidden ?? false,
            extra: (it.extra ?? {}) as Prisma.InputJsonValue,
          })),
        }),
      ]);
      if (outside(items) !== before) {
        // товары или сроки поменялись — бейджи в каталоге и статус на страницах товаров: пересобрать всё
        await store.purge();
        await notifyWeb('all');
      } else {
        // типы, фото, названия, порядок — страницы со складом (главная, /nalichie/); цены — ещё и страницы этих товаров
        const after = prices(items.map((it) => ({ ...it, priceFrom: Boolean(it.price && it.priceFrom), priceNote: it.price ? it.priceNote : null })));
        const priced = [...new Set([...pricesBefore.keys(), ...after.keys()])].filter((url) => url.startsWith('/products/') && pricesBefore.get(url) !== after.get(url));
        const pages = [...new Set([...(await store.stockPages()), ...priced])];
        await store.purge(pages.length ? pages : ['/nalichie/']);
        await notifyWeb(pages);
      }
      return { ok: true, groups: groups.length, items: items.length };
    },
  );

  // ── Кеш ────────────────────────────────────────────────────────────────
  app.post(
    '/admin/v1/cache/purge',
    {
      schema: {
        tags: ['Админка: сервис'],
        summary: 'Сбросить кеш (страниц или весь) и перегенерировать сайт',
        body: z.object({ paths: z.array(z.string()).optional() }).optional(),
        security: ADMIN,
      },
    },
    async (req) => {
      const paths = req.body?.paths;
      const removed = await store.purge(paths);
      await notifyWeb(paths?.length ? paths : 'all');
      return { ok: true, removed };
    },
  );
}
