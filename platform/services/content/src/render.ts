import {
  buildPageJsonLd,
  detectPageFeatures,
  externalStyleUrl,
  htmlToText,
  isSearchable,
  pickSearchImage,
  searchWeight,
  stripHtmlComments,
  type StockOffer,
} from '@mtpk/content-kit';
import { localizeHtml, translateText, type Dictionary, type Locale } from '@mtpk/content-kit/i18n';
import { walkBlocks, type Block } from '@mtpk/content-model';
import { renderBlocksToHtml, renderFormSlots } from '@mtpk/ui/server';
import type { Page, StyleBlock } from '@mtpk/db';
import type { PageDto } from '@mtpk/shared';

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Блоки, повторяющиеся на сотнях страниц (формы, преимущества) — не контент страницы. */
const SHARED_BLOCKS = new Set(['leadgen', 'bestOffer', 'catalogCta', 'partner', 'adv', 'whyUs', 'lightbox']);

/**
 * HTML страницы для SEO-вычислений (JSON-LD, картинка и текст для поиска,
 * склад, сравнение): те же React-компоненты, что видит посетитель, без
 * клиентских добавок (бейджей склада, кнопок сравнения).
 */
export function seoHtml(page: Pick<Page, 'path' | 'blocks'>, opts: { contentOnly?: boolean } = {}): string {
  let blocks = page.blocks as Block[];
  if (opts.contentOnly) blocks = blocks.filter((b) => !SHARED_BLOCKS.has(b.type));
  return renderBlocksToHtml(blocks, { path: page.path });
}

/**
 * Старые клиентские скрипты нужны только блокам «HTML как есть» (каталог
 * запчастей, проекты, бейджи в старых карточках…): у типизированных блоков
 * поведение — в модулях сайта. Формы заявок, «Запросить цену» и сравнение
 * модули сайта обслуживают на всей странице — их старые скрипты не нужны.
 */
const REPLACED_BY_MODULES = new Set(['quote-form', 'compare', 'phero-gallery', 'stock-product', 'spec-tabs']);
export function legacyFeatures(blocks: Block[]): string[] {
  const html = [...walkBlocks(blocks)]
    .filter((b): b is Extract<Block, { type: 'html' }> => b.type === 'html')
    .map((b) => b.html)
    .join('\n');
  return html ? detectPageFeatures(html).filter((f) => !REPLACED_BY_MODULES.has(f)) : [];
}

/** Запись БД → страница для вывода. offer — цена товара со склада (в разметку Product). */
export function renderPage(page: Page, styles: Map<string, StyleBlock>, site: string, offer?: StockOffer): PageDto {
  const base = {
    path: page.path,
    kind: page.kind as PageDto['kind'],
    template: page.template,
    title: page.title,
    description: page.description,
    noindex: page.noindex,
    preloadImage: page.preloadImage,
    publishedAt: iso(page.publishedAt),
    modifiedAt: iso(page.modifiedAt),
    lastmodAt: page.lastmodAt.toISOString(),
  };

  if (page.kind === 'document') {
    // Практикум: готовый документ, при сборке у него тоже вырезались комментарии.
    return {
      ...base,
      blocks: [],
      // формы — тегом <ui-form>: на их месте разметка компонента формы
      bodyHtml: renderFormSlots(stripHtmlComments(page.body ?? '')),
      cssTemplates: [],
      externalStyles: [],
      inlineStyles: [],
      jsonLd: [],
      features: [],
      searchable: Boolean((page.extraMeta as Record<string, unknown>)?.pagefindBody),
      searchWeight: 1,
      searchImage: null,
    };
  }

  // Все стили страницы — внешние файлы (в коде страницы <style> нет). Порядок
  // каскада прежний: сначала крупные блоки, затем мелкие.
  const known = page.styleHashes.map((h) => styles.get(h)).filter((b) => b !== undefined);
  const externalStyles = [...known.filter((b) => b.mode === 'external'), ...known.filter((b) => b.mode !== 'external')].map((b) =>
    externalStyleUrl(b.hash),
  );

  const blocks = page.blocks as Block[];
  const html = seoHtml(page);
  return {
    ...base,
    blocks,
    cssTemplates: page.cssTemplates,
    externalStyles,
    inlineStyles: [],
    jsonLd: buildPageJsonLd(
      html,
      {
        path: page.path,
        title: page.title,
        description: page.description,
        publishedAt: iso(page.publishedAt),
        modifiedAt: iso(page.modifiedAt),
      },
      site,
      offer,
    ),
    features: legacyFeatures(blocks),
    searchable: isSearchable(page.path),
    searchWeight: searchWeight(page.path, html),
    searchImage: pickSearchImage(html, page.preloadImage),
  };
}

export interface SearchDoc {
  path: string;
  title: string;
  body: string;
  image: string | null;
  weight: number;
}

function stripCrumbs(html: string): string {
  return html
    .replace(/<nav\s+[^>]*class="(?:breadcrumb|tr-crumbs)[^"]*"[^>]*>[\s\S]*?<\/nav>/g, ' ')
    .replace(/<div\s+class="(?:breadcrumbs|ui-crumb)"[^>]*>[\s\S]*?<\/div>/g, ' ');
}

/**
 * Бейджи на обложках («Сделано в России») — оформление, а не текст страницы:
 * в индекс прежнего сайта они не попадали (их дорисовывал скрипт).
 */
function stripBadges(html: string): string {
  return html.replace(/<span[^>]*class="made-badge"[^>]*>[\s\S]*?<\/span>[^<]*<\/span>/g, ' ');
}

/** Текст первого <h1> — Pagefind брал заголовок результата именно отсюда. */
function firstH1(html: string): string | null {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? htmlToText(m[1]) : null;
}

/** Содержимое элемента с data-pagefind-body (у документов Практикума). */
function pagefindRegion(html: string): string {
  const open = html.search(/<[a-z]+[^>]*\bdata-pagefind-body\b[^>]*>/i);
  if (open < 0) return html;
  const tag = html.slice(open + 1).match(/^[a-z]+/i)?.[0] ?? 'main';
  const close = html.lastIndexOf(`</${tag}>`);
  return html.slice(open, close > open ? close : undefined);
}

/** Неразрывный дефис (УИД\u2011376) → обычный: иначе поиск по коду модели не совпадает. */
const hyphens = (t: string) => t.replace(/[\u2010\u2011\u2012]/g, '-');

/**
 * Документ для поискового индекса: собственный текст страницы (без общих
 * блоков форм и преимуществ — иначе их слова находились бы на каждой странице).
 */
export function toSearchDoc(page: Page, dto: PageDto, locale: Locale, dict: Dictionary): SearchDoc | null {
  if (!dto.searchable || page.noindex || page.status !== 'published') return null;
  const source = localizeHtml(stripBadges(stripCrumbs(page.kind === 'document' ? pagefindRegion(page.body ?? '') : seoHtml(page, { contentOnly: true }))), locale, dict);
  const title = hyphens(firstH1(source) || translateText(page.title, dict).split('|')[0].trim());
  return {
    path: `/${locale}${page.path}`,
    title,
    body: hyphens(htmlToText(source)),
    image: dto.searchImage,
    weight: dto.searchWeight,
  };
}
