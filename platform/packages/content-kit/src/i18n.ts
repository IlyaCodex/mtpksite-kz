import { parseFragment, serialize, type DefaultTreeAdapterMap } from 'parse5';

/**
 * Языки сайта для Казахстана: /ru/, /kz/, /en/. Содержимое одно — русское, в базе; переводы — словарём
 * «русская строка → перевод» (таблица content.translations). Готовая страница проходит здесь один раз при
 * генерации: текст и подписи — по словарю, адреса страниц — с приставкой языка. Строки без перевода остаются
 * русскими: страница не ломается, список недостающих даёт scripts/kz/missing-translations.ts.
 */
export const LOCALES = ['ru', 'kz', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ru';
export const isLocale = (s: unknown): s is Locale => LOCALES.includes(s as Locale);

/** Код языка для lang и hreflang: адрес /kz/, язык — kk. */
export const LANG_CODE: Record<Locale, string> = { ru: 'ru', kz: 'kk', en: 'en' };
export const OG_LOCALE: Record<Locale, string> = { ru: 'ru_RU', kz: 'kk_KZ', en: 'en_US' };

export type Dictionary = ReadonlyMap<string, string>;

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
type TextNode = DefaultTreeAdapterMap['textNode'];

/** Ключ словаря: текст без мягких переносов, с обычными пробелами. */
export function normalizeText(s: string): string {
  return s
    .replace(/­/g, '')
    .replace(/[\s   ]+/g, ' ')
    .trim();
}

/** Перевод строки с сохранением пробелов по краям (между соседними элементами они значимы). */
export function translateText(text: string, dict: Dictionary): string {
  const key = normalizeText(text);
  const target = key ? dict.get(key) : undefined;
  if (target === undefined) return text;
  const lead = /^[\s ]*/.exec(text)![0];
  const tail = /[\s ]*$/.exec(text)![0];
  return lead + target + tail;
}

/** Файлы и служебные адреса: у них нет языка. */
const NOT_PAGE = /^\/(?:img|files|docs|og|css|js|fonts|brand|data|assets|api|admin|_next|r)(?:[/?#]|$)|\.[a-z0-9]{2,5}(?:[?#]|$)/i;
const HAS_LOCALE = new RegExp(`^/(?:${LOCALES.join('|')})(?:[/?#]|$)`);

/** Адрес страницы на языке: /products/x/ → /kz/products/x/. Файлы, якоря и внешние ссылки — как есть. */
export function localizeHref(href: string, locale: Locale): string {
  if (!href.startsWith('/') || href.startsWith('//') || NOT_PAGE.test(href) || HAS_LOCALE.test(href)) return href;
  return `/${locale}${href}`;
}

/** Адрес без приставки языка: { locale: 'kz', path: '/products/x/' }. Приставки нет — locale null. */
export function splitLocalePath(pathname: string): { locale: Locale | null; path: string } {
  const m = /^\/(ru|kz|en)(\/.*)?$/.exec(pathname);
  if (!m) return { locale: null, path: pathname };
  return { locale: m[1] as Locale, path: m[2] ?? '/' };
}

/** Переводимые атрибуты: подписи, подсказки и то, что скрипты показывают посетителю. */
const TEXT_ATTRS = new Set(['alt', 'title', 'placeholder', 'aria-label', 'label', 'data-caption', 'data-alt', 'data-part']);
/** Адреса страниц в атрибутах. */
const LINK_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'data-href']),
  area: new Set(['href']),
  form: new Set(['action']),
  span: new Set(['data-href']),
};
/** Внутрь не заходим: код и служебная разметка. */
const SKIP = new Set(['script', 'style', 'noscript', 'svg']);

const isElement = (n: Node): n is Element => 'tagName' in n;
const isText = (n: Node): n is TextNode => n.nodeName === '#text';
const childrenOf = (n: Element): Node[] =>
  n.tagName === 'template' ? ((n as unknown as { content: { childNodes: Node[] } }).content.childNodes ?? []) : (n.childNodes as Node[]);

function walk(nodes: Node[], visitText: (n: TextNode) => void, visitElement: (el: Element) => void): void {
  for (const n of nodes) {
    if (isText(n)) visitText(n);
    else if (isElement(n) && !SKIP.has(n.tagName)) {
      visitElement(n);
      walk(childrenOf(n), visitText, visitElement);
    }
  }
}

/** Кнопка <input>: её значение — надпись. */
const isInputButton = (el: Element) => el.tagName === 'input' && el.attrs.some((a) => a.name === 'type' && (a.value === 'submit' || a.value === 'button'));

/** Готовый HTML страницы на языке: текст и подписи — по словарю, адреса — с приставкой языка. */
export function localizeHtml(html: string, locale: Locale, dict: Dictionary): string {
  const frag = parseFragment(html);
  walk(
    frag.childNodes as Node[],
    (n) => {
      n.value = translateText(n.value, dict);
    },
    (el) => {
      for (const a of el.attrs) {
        if (TEXT_ATTRS.has(a.name) || (a.name === 'value' && isInputButton(el))) a.value = translateText(a.value, dict);
        else if (LINK_ATTRS[el.tagName]?.has(a.name)) a.value = localizeHref(a.value, locale);
      }
    },
  );
  return serialize(frag);
}

export interface PageText {
  /** text — текст, атрибут — его имя */
  kind: string;
  /** родительский тег: сопоставление строк страницы на двух языках */
  parent: string;
  text: string;
}

const hasLetters = (s: string) => /\p{L}/u.test(s);

/** Все переводимые строки HTML по порядку — те же, что заменяет localizeHtml. */
export function pageTexts(nodes: Node[]): PageText[] {
  const out: PageText[] = [];
  walk(
    nodes,
    (n) => {
      const text = normalizeText(n.value);
      if (hasLetters(text)) out.push({ kind: 'text', parent: (n.parentNode as Element | null)?.tagName ?? '', text });
    },
    (el) => {
      // по имени: порядок атрибутов в разметке разных версий страницы может отличаться
      for (const a of [...el.attrs].sort((x, y) => (x.name < y.name ? -1 : 1))) {
        if (!TEXT_ATTRS.has(a.name) && !(a.name === 'value' && isInputButton(el))) continue;
        const text = normalizeText(a.value);
        if (hasLetters(text)) out.push({ kind: a.name, parent: el.tagName, text });
      }
    },
  );
  return out;
}

/** Разметка страницы (JSON-LD) на языке: подписи — по словарю, адреса сайта — с приставкой языка. */
export function localizeJsonLd<T>(json: T, locale: Locale, dict: Dictionary, site: string): T {
  const value = (v: unknown, key: string): unknown => {
    if (typeof v === 'string') {
      if (key.startsWith('@')) return v;
      if (v.startsWith(`${site}/`)) return site + localizeHref(v.slice(site.length), locale);
      return translateText(v, dict);
    }
    if (Array.isArray(v)) return v.map((x) => value(x, key));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, value(x, k)]));
    return v;
  };
  // разметка страницы приходит строкой JSON (как пишется в <script>)
  if (typeof json === 'string') return JSON.stringify(value(JSON.parse(json), '')) as T;
  return value(json, '') as T;
}
