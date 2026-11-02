import { parseFragment, serialize, type DefaultTreeAdapterMap } from 'parse5';
import { localizeHref, normalizeText, translateText, type Dictionary, type Locale } from './locale.ts';

export * from './locale.ts';

/** Перевод готового HTML: без браузера (parse5), поэтому отдельно от locale.ts — его берут и скрипты сайта. */

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
type TextNode = DefaultTreeAdapterMap['textNode'];


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

/** visitElement вернул false — внутрь элемента не заходим: он уже переведён целиком. */
function walk(nodes: Node[], visitText: (n: TextNode) => void, visitElement: (el: Element) => boolean | void): void {
  for (const n of nodes) {
    if (isText(n)) visitText(n);
    else if (isElement(n) && !SKIP.has(n.tagName) && !n.attrs.some((a) => a.name === 'translate' && a.value === 'no')) {
      if (visitElement(n) !== false) walk(childrenOf(n), visitText, visitElement);
    }
  }
}

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4']);
const INLINE = new Set(['em', 'strong', 'b', 'i', 'br']);

/**
 * Заголовок с выделением разбит тегами на куски, и в другом языке порядок слов иной: такой заголовок переводится целиком,
 * ключ словаря — его разметка («Сравнение <em>оборудования</em>»), в переводе те же теги могут стоять на других словах.
 * Перевода целиком нет — заголовок переводится по кускам, как остальной текст. Заголовок с другими тегами (ссылки, значки) — по кускам.
 */
export function headingKey(el: Element): string | null {
  if (!HEADINGS.has(el.tagName)) return null;
  const inner = (nodes: Node[]): string | null => {
    let out = '';
    for (const n of nodes) {
      if (isText(n)) out += n.value;
      else if (isElement(n) && INLINE.has(n.tagName) && !n.attrs.length) {
        if (n.tagName === 'br') {
          out += '<br>';
          continue;
        }
        const body = inner(n.childNodes as Node[]);
        if (body === null) return null;
        out += `<${n.tagName}>${body}</${n.tagName}>`;
      } else return null;
    }
    return out;
  };
  const html = inner(el.childNodes as Node[]);
  if (html === null || !html.includes('<')) return null;
  return normalizeText(html)
    .replace(/\s*<br>\s*/g, '<br>')
    .replace(/&/g, '&amp;');
}

/** Ключи заголовков куска страницы — для списка строк без перевода. */
export function headingKeys(nodes: Node[]): string[] {
  const out: string[] = [];
  walk(
    nodes,
    () => undefined,
    (el) => {
      const key = headingKey(el);
      if (key && /\p{L}/u.test(key)) out.push(key);
    },
  );
  return out;
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
      const key = headingKey(el);
      const whole = key ? dict.get(key) : undefined;
      if (whole === undefined) return;
      el.childNodes = parseFragment(whole).childNodes;
      for (const c of el.childNodes) c.parentNode = el;
      return false;
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

/** Строки куска HTML: те, что переводит localizeHtml. */
export const htmlTexts = (html: string): string[] => pageTexts(parseFragment(html).childNodes as Node[]).map((t) => t.text);

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
