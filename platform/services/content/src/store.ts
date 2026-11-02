import {
  buildCompareIndex,
  hasStockBlocks,
  pickStockImage,
  pickStockTitle,
  resolveStock,
  resolveStockBlocks,
  resolveStockView,
  stockBySlug,
  type StockConfigItem,
  type StockItemRow,
  type StockJsonItem,
  type StockView,
} from '@mtpk/content-kit';
import { hiddenPages, resolveCatalogBlocks, type CatalogData } from '@mtpk/content-kit/catalog';
import { darkVars } from '@mtpk/content-kit/dark';
import { LOCALES, splitLocalePath, type Dictionary, type Locale } from '@mtpk/content-kit/i18n';
import { hiddenTest, pruneHiddenHtml, pruneHiddenLinks, type HiddenTest } from '@mtpk/content-kit/hidden-links';
import { styleFileCss } from '@mtpk/content-kit/styles';
import { DEFAULT_HOLIDAYS, DEFAULT_SETTINGS, holidaySettings, siteSettings, type Block, type HolidaySettings, type SiteSettings } from '@mtpk/content-model';
import { hiddenSitePages, loadCatalog } from './catalog-data.ts';
import type { Db, Page, StyleBlock } from './db.ts';
import type { JsonCache, Logger, PageDto, PageListItem, RedirectDto } from '@mtpk/shared';
import { renderPage, seoHtml, toSearchDoc, type SearchDoc } from './render.ts';
import type { SiteDataDto } from '@mtpk/shared';

const MISSING = { missing: true } as const;
type Cached<T> = T | typeof MISSING;

/** Блоки страницы для вывода: карточки — из каталога, у товара — общие блоки его категории. */
function withCatalog<T extends { id: number; blocks: unknown }>(row: T, data: CatalogData): T {
  return { ...row, blocks: resolveCatalogBlocks(row, row.blocks as Block[], data) };
}

/** Ведёт ли ссылка в раздел каталога, скрытый тумблером (null — скрытых нет). */
function hiddenHref(data: CatalogData): HiddenTest | null {
  return hiddenTest(hiddenPages(data).paths);
}

/** То же плюс склад: блоки склада получают типы и позиции. */
function withData<T extends { id: number; blocks: unknown }>(row: T, data: CatalogData, stock: StockView | null): T {
  const out = withCatalog(row, data);
  return stock ? { ...out, blocks: resolveStockBlocks(out.blocks as Block[], stock) } : out;
}

/**
 * Доступ к контенту с кешем в Redis. Всё, что отдаётся сайту, — производное
 * от таблиц content.*: страница с развёрнутыми блоками (карточки каталога,
 * шаблон товара), склад, индекс сравнения.
 */
const DICTIONARY_TTL_MS = 5 * 60_000;

export class ContentStore {
  private styles: Map<string, StyleBlock> | null = null;
  private dictionaries = new Map<Locale, { at: number; dict: Dictionary }>();
  /** готовые CSS-файлы по хешу: блок стилей по хешу не меняется — переделку цветов делаем один раз */
  private readonly styleFiles = new Map<string, string>();

  constructor(
    private readonly db: Db,
    private readonly cache: JsonCache,
    private readonly site: string,
    private readonly ttl: number,
    private readonly log: Logger,
  ) {}

  private async styleMap(): Promise<Map<string, StyleBlock>> {
    if (!this.styles) {
      const rows = await this.db.styleBlock.findMany();
      this.styles = new Map(rows.map((r) => [r.hash, r]));
    }
    return this.styles;
  }

  private async loadPage(path: string): Promise<Page | null> {
    const row = await this.db.page.findUnique({ where: { path } });
    if (!row || row.status !== 'published') return null;
    // раздел каталога скрыт тумблером (сам или вместе с разделом выше) — страницы на сайте нет
    return (await this.hidden()).ids.has(row.id) ? null : row;
  }

  /** Страницы, скрытые с сайта тумблерами каталога: записи каталога и страницы внутри скрытых разделов. */
  private async hidden(): Promise<{ ids: Set<number>; paths: Set<string> }> {
    const list = await this.cache.wrap('hidden-pages', this.ttl, async () => {
      const h = await hiddenSitePages(this.db, await this.catalog());
      return { ids: [...h.ids], paths: [...h.paths] };
    });
    return { ids: new Set(list.ids), paths: new Set(list.paths) };
  }

  /** Каталог: категории, подкатегории, товары — из них собираются карточки и шаблоны страниц. */
  async catalog(): Promise<CatalogData> {
    return this.cache.wrap('catalog', this.ttl, () => loadCatalog(this.db));
  }

  async getPage(path: string): Promise<PageDto | null> {
    const key = `page:${path}`;
    const hit = await this.cache.get<Cached<PageDto>>(key);
    if (hit) return 'missing' in hit ? null : hit;
    const row = await this.loadPage(path);
    if (!row) {
      // короткий отрицательный кеш: сканеры перебирают несуществующие адреса
      await this.cache.set(key, MISSING, 60);
      return null;
    }
    // товар со склада с ценой — цена в разметке Product (offers)
    const slug = path.replace(/^\/+|\/+$/g, '').replace(/^products\//, '');
    const offer = path.startsWith('/products/') ? (await this.siteData()).stock[slug]?.offer : undefined;
    const dto = renderPage(await this.pageData(row), await this.styleMap(), this.site, offer);
    await this.cache.set(key, dto, this.ttl);
    return dto;
  }

  async listPages(): Promise<PageListItem[]> {
    return this.cache.wrap('pages:list', this.ttl, async () => {
      const rows = await this.db.page.findMany({
        select: { id: true, path: true, kind: true, template: true, noindex: true, lastmodAt: true },
        where: { status: 'published' },
        orderBy: { path: 'asc' },
      });
      // скрытые разделы каталога — не в карте сайта и не в списке страниц сайта
      const { ids } = await this.hidden();
      return rows.filter((r) => !ids.has(r.id)).map(({ id: _id, ...r }) => ({ ...r, kind: r.kind as PageListItem['kind'], lastmodAt: r.lastmodAt.toISOString() }));
    });
  }

  async listRedirects(): Promise<RedirectDto[]> {
    return this.cache.wrap('redirects', this.ttl, async () => {
      const rows = await this.db.redirect.findMany({ orderBy: { fromPath: 'asc' } });
      return rows.map((r) => ({ from: r.fromPath, to: r.toPath, code: r.code }));
    });
  }

  /**
   * CSS-файл стилей страницы по хешу (/css/inline-extracted/inline-<хеш>.css).
   * Цвета — с переменными тёмной темы (content-kit/src/dark.ts): светлая тема
   * та же, у тёмной — свои значения.
   */
  async styleCss(hash: string): Promise<string | null> {
    const ready = this.styleFiles.get(hash);
    if (ready !== undefined) return ready;
    const block = (await this.styleMap()).get(hash);
    if (!block) return null;
    // и свои переменные с цветом (--ink: #142a32) — как у шаблонов
    const css = darkVars(styleFileCss(block), { ownVars: true });
    this.styleFiles.set(hash, css);
    return css;
  }

  /** Блоки страницы с данными каталога и (если на ней есть блоки склада) склада. */
  async pageData<T extends { id: number; blocks: unknown }>(row: T, catalog?: CatalogData): Promise<T> {
    const data = catalog ?? (await this.catalog());
    const stock = hasStockBlocks(row.blocks as Block[]) ? await this.stockView() : null;
    const out = withData(row, data, stock);
    // карточки, разделы и ссылки скрытых тумблером разделов каталога — не на сайте (в базе и в админке — как есть)
    const hidden = hiddenHref(data);
    if (!hidden) return out;
    const body = (out as { body?: unknown }).body;
    return { ...out, blocks: pruneHiddenLinks(out.blocks as Block[], hidden), ...(typeof body === 'string' ? { body: pruneHiddenHtml(body, hidden).html } : {}) };
  }

  /**
   * Склад для блоков сайта: типы и позиции из раздела админки «Наличие на
   * складе», недостающее у позиций (название, фото, характеристики) — из
   * каталога. Тип без позиций не показывается.
   */
  async stockView(): Promise<StockView> {
    return this.cache.wrap('stock-view', this.ttl, async () => {
      const [groups, items] = await Promise.all([
        this.db.stockGroup.findMany({ orderBy: [{ position: 'asc' }, { id: 'asc' }] }),
        this.db.stockItem.findMany({ orderBy: [{ position: 'asc' }, { id: 'asc' }] }),
      ]);
      // страницы не из таблиц каталога (запчасти): название и фото — с их разметки
      const { pages } = await this.stockSource();
      // скрытые в админке позиции на сайт не выводятся — и позиции скрытых тумблером разделов каталога;
      // тип, где все позиции скрыты, тоже не показывается
      const catalog = await this.catalog();
      const off = hiddenHref(catalog);
      return resolveStockView(groups, items.filter((it) => !it.hidden && !off?.(String(it.url || ''))), catalog, (path) => pages[path]);
    });
  }

  /** Название (простым текстом) и фото позиций — как их покажет сайт, в порядке позиций (список в админке). */
  async stockPreviews(items: StockItemRow[]): Promise<{ title: string; image: string | null }[]> {
    const { pages } = await this.stockSource();
    // без типов порядок позиций сохраняется
    const { items: views } = resolveStockView([], items, await this.catalog(), (path) => pages[path]);
    return views.map((v) => ({
      title: v.title.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
      image: v.image?.src ?? null,
    }));
  }

  /** Страницы с блоками склада: в их карточках названия и фото товаров — кеш сбрасывается и при правке каталога. */
  async stockPages(): Promise<string[]> {
    return this.cache.wrap('stock-pages', this.ttl, async () => {
      const rows = await this.db.$queryRaw<{ path: string }[]>`SELECT path FROM content.pages WHERE blocks::text LIKE '%"stockShowcase"%' OR blocks::text LIKE '%"stockList"%'`;
      return rows.map((r) => r.path);
    });
  }

  /** /data/stock.json — тот же формат, что писал build-stock.mjs. */
  async stock(): Promise<Record<string, unknown>> {
    return (await this.stockSource()).json;
  }

  /** stock.json и название и фото страниц позиций (до подстановки своих — для склада на страницах). */
  private async stockSource(): Promise<{ json: Record<string, unknown>; pages: Record<string, { title: string; image: string | null }> }> {
    return this.cache.wrap('stock-source', this.ttl, async () => {
      const items = await this.db.stockItem.findMany({ orderBy: { position: 'asc' } });
      const catalog = await this.catalog();
      const off = hiddenHref(catalog);
      // в stock.json (бейдж «В наличии», срок на странице товара) — только позиции, которые показываются на сайте
      // (не скрытые в «Наличии» и не в скрытых разделах каталога); страницы нужны всем позициям — превью в админке
      const config: StockConfigItem[] = items.filter((it) => !it.hidden && !off?.(String(it.url || ''))).map((it) => {
        const extra = (it.extra ?? {}) as Record<string, unknown>;
        return {
          ...extra,
          url: it.url,
          qty: it.qty ?? (extra.qty as number | undefined),
          shipping: it.shipping,
          note: it.note,
          specs: it.specs as StockConfigItem['specs'],
          image: it.image,
          title: it.title,
          price: it.price,
          priceFrom: it.priceFrom,
          priceNote: it.priceNote,
        };
      });
      const wanted = new Set(items.map((it) => String(it.url || '').trim()).filter(Boolean));
      const rows = wanted.size
        ? await this.db.page.findMany({ select: { id: true, path: true, blocks: true, title: true }, where: { path: { in: [...wanted] } } })
        : [];
      // разметка страниц — серверный рендер тех же блоков, что видит посетитель
      const byPath = new Map(rows.map((r) => [r.path, { body: seoHtml(withCatalog(r, catalog)), title: r.title }]));
      const { items: resolved, warnings } = resolveStock(config, (p) => byPath.get(p));
      for (const w of warnings) this.log.warn({ stock: w }, 'склад');
      const pages = Object.fromEntries([...byPath].map(([path, p]) => [path, { title: pickStockTitle(p.body, p.title), image: pickStockImage(p.body) }]));
      return {
        json: { _generated: 'content-service — не редактировать. Источник: таблица content.stock_items', _count: resolved.length, items: resolved },
        pages,
      };
    });
  }

  /** Индекс сравнения: { index, sections } — compare-index.json и compare-sections.json. */
  async compare(): Promise<{ index: unknown; sections: string[] }> {
    return this.cache.wrap('compare', this.ttl * 24, async () => {
      const rows = await this.db.page.findMany({ select: { id: true, path: true, blocks: true }, where: { path: { startsWith: '/products/' } } });
      const catalog = await this.catalog();
      // товары скрытых тумблером разделов в сравнение не попадают
      const { ids: hidden } = await this.hidden();
      const shown = rows.filter((r) => !hidden.has(r.id));
      const { index, sections, report } = buildCompareIndex(shown.map((r) => ({ path: r.path, body: seoHtml(withCatalog(r, catalog)) })));
      this.log.info({ sections: sections.length, scanned: report.scanned }, 'индекс сравнения пересобран');
      return { index, sections };
    });
  }

  /** Данные для рендера блоков на сайте: склад (slug → срок) и разделы со сравнением. */
  async siteData(): Promise<SiteDataDto> {
    return this.cache.wrap('site-data', this.ttl, async () => {
      const stock = (await this.stock()) as { items?: StockJsonItem[] };
      const items = (stock.items ?? []).map((it) => ({ ...it, slug: it.slug ? String(it.slug).replace(/^\/+|\/+$/g, '') : undefined }));
      // срок отгрузки и цена со склада — у страницы товара (статус, цена в карточке, разметка Product)
      const map: SiteDataDto['stock'] = stockBySlug(items);
      return { stock: map, compareSections: (await this.compare()).sections };
    });
  }

  /** Настройки сайта (контакты, меню, подвал). Нет записи или она битая — значения по умолчанию. */
  async settings(): Promise<SiteSettings> {
    return this.cache.wrap('settings', this.ttl, async () => {
      const row = await this.db.setting.findUnique({ where: { key: 'site' } });
      if (!row) return DEFAULT_SETTINGS;
      const parsed = siteSettings.safeParse(row.value);
      if (parsed.success) return parsed.data;
      this.log.error({ issues: parsed.error.issues.slice(0, 5) }, 'настройки сайта не прошли проверку — отдаём значения по умолчанию');
      return DEFAULT_SETTINGS;
    });
  }

  /**
   * Настройки для сайта: без ссылок на скрытые разделы каталога — пункт мегаменю, мобильного меню и подвала,
   * ведущий на скрытую страницу, не показывается (в админке настройки — как есть).
   */
  async siteSettings(): Promise<SiteSettings> {
    const settings = await this.settings();
    const { paths } = await this.hidden();
    if (!paths.size) return settings;
    const off = (v: unknown): boolean =>
      typeof v === 'object' && v !== null && typeof (v as { href?: unknown }).href === 'string' && paths.has((v as { href: string }).href.replace(/[?#].*$/, ''));
    const prune = (v: unknown): unknown =>
      Array.isArray(v) ? v.filter((x) => !off(x)).map(prune) : typeof v === 'object' && v !== null ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, prune(x)])) : v;
    return prune(settings) as SiteSettings;
  }

  /** Праздничные баннеры главной (раздел «Праздники»). Нет записи или она битая — праздники по умолчанию. */
  async holidays(): Promise<HolidaySettings> {
    return this.cache.wrap('holidays', this.ttl, async () => {
      const row = await this.db.setting.findUnique({ where: { key: 'holidays' } });
      if (!row) return DEFAULT_HOLIDAYS;
      const parsed = holidaySettings.safeParse(row.value);
      if (parsed.success) return parsed.data;
      this.log.error({ issues: parsed.error.issues.slice(0, 5) }, 'расписание праздников не прошло проверку — отдаём праздники по умолчанию');
      return DEFAULT_HOLIDAYS;
    });
  }

  async purgeHolidays(): Promise<void> {
    await this.cache.del('holidays');
  }

  /** Словарь языка для поиска и данных сравнения (у сайта свой — lib/content.ts). */
  async dictionary(locale: Locale): Promise<Dictionary> {
    const known = this.dictionaries.get(locale);
    if (known && Date.now() - known.at < DICTIONARY_TTL_MS) return known.dict;
    const rows = await this.db.translation.findMany({ where: { locale }, select: { source: true, target: true } });
    const dict = new Map(rows.map((r) => [r.source, r.target]));
    this.dictionaries.set(locale, { at: Date.now(), dict });
    return dict;
  }

  resetDictionaries(): void {
    this.dictionaries.clear();
  }

  /** Документ поиска по адресу с языком: /kz/products/x/. */
  async searchDoc(localePath: string): Promise<SearchDoc | null> {
    const { locale, path } = splitLocalePath(localePath);
    if (!locale) return null;
    const found = await this.loadPage(path);
    if (!found) return null;
    const row = await this.pageData(found);
    return toSearchDoc(row, renderPage(row, await this.styleMap(), this.site), locale, await this.dictionary(locale));
  }

  /** Все документы для поиска — постранично, чтобы не держать 50 МБ HTML разом. */
  async *searchDocs(batch = 100): AsyncGenerator<SearchDoc> {
    const styles = await this.styleMap();
    const catalog = await this.catalog();
    const { ids: hidden } = await this.hidden();
    const paths = (await this.db.page.findMany({ select: { path: true }, orderBy: { path: 'asc' } })).map((r) => r.path);
    for (let i = 0; i < paths.length; i += batch) {
      const rows = await this.db.page.findMany({ where: { path: { in: paths.slice(i, i + batch) } } });
      for (const found of rows) {
        if (found.status !== 'published' || hidden.has(found.id)) continue;
        const row = await this.pageData(found, catalog);
        const dto = renderPage(row, styles, this.site);
        for (const locale of LOCALES) {
          const doc = toSearchDoc(row, dto, locale, await this.dictionary(locale));
          if (doc) yield doc;
        }
      }
    }
  }

  async purgeRedirects(): Promise<void> {
    await this.cache.del('redirects');
  }

  /**
   * Сброс кеша: конкретные страницы (+ производные списки) или всё. Каталог
   * сбрасывается всегда: адрес и статус страницы входят в его карточки.
   */
  async purge(paths?: string[]): Promise<number> {
    this.styles = null;
    if (!paths || !paths.length) return this.cache.clear();
    await this.cache.del(...paths.map((p) => `page:${p}`), 'pages:list', 'redirects', 'stock-source', 'stock-view', 'stock-pages', 'site-data', 'catalog', 'hidden-pages');
    if (paths.some((p) => p.startsWith('/products/'))) await this.cache.del('compare');
    return paths.length;
  }
}
