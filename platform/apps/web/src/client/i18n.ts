import { isLocale, LANG_CODE, localizeHref, normalizeText, translateText, type Dictionary, type Locale } from '@mtpk/content-kit/locale';

/**
 * Язык в браузере. Страница приходит уже переведённой (content-kit/i18n.ts), но скрипты вставляют и свои куски:
 * таблицу сравнения, окно поиска, подсказки форм — с русским текстом и адресами без языка. Вставленное приводится
 * к языку страницы сразу, до отрисовки: адреса — всегда, текст — по словарю /data/ui-strings.json (список — в
 * content-kit/ui-strings.ts; грузится, когда встретилась первая такая строка; у русской версии словаря нет).
 * Строка с числами («Найдено: 5») ищется и как шаблон «Найдено: {n}». Словарь — и шапка с подвалом: они нужны странице 404.
 */
const CYRILLIC = /[А-Яа-яЁё]/;
const TEXT_ATTRS = ['alt', 'title', 'placeholder', 'aria-label'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);

/** Язык — по адресу: страница 404 одна на все языки, и язык в её разметке всегда русский. */
export const pageLocale = (): Locale => {
  const code = location.pathname.split('/')[1];
  return isLocale(code) ? code : 'ru';
};

/** Адрес страницы без приставки языка: /kz/products/x/ → /products/x/. */
export const withoutLocale = (pathname: string): string => pathname.replace(/^\/(?:ru|kz|en)(?=\/|$)/, '') || '/';

/** Адрес страницы на языке текущей страницы. */
export const localized = (href: string): string => localizeHref(href, pageLocale());

function translateAny(text: string, dict: Dictionary): string {
  const direct = translateText(text, dict);
  if (direct !== text || !/\d/.test(text)) return direct;
  const numbers = normalizeText(text).match(/\d+/g) ?? [];
  const pattern = dict.get(normalizeText(text).replace(/\d+/g, '{n}'));
  if (!pattern) return text;
  let i = 0;
  return text.match(/^\s*/)![0] + pattern.replace(/\{n\}/g, () => numbers[i++] ?? '') + text.match(/\s*$/)![0];
}

export function initI18n(): void {
  const locale = pageLocale();
  const needsText = locale !== 'ru';
  let dict: Dictionary | null = null;
  let waiting: Node[] | null = null;

  const translateNode = (node: Node, d: Dictionary) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.parentElement && (SKIP.has(node.parentElement.tagName) || node.parentElement.closest('[translate="no"]'))) return;
      const value = node.nodeValue ?? '';
      if (CYRILLIC.test(value)) {
        const next = translateAny(value, d);
        if (next !== value) node.nodeValue = next;
      }
      return;
    }
    const root = node as Element;
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (el.closest('[translate="no"]')) continue;
      for (const name of TEXT_ATTRS) {
        const value = el.getAttribute(name);
        if (value && CYRILLIC.test(value)) {
          const next = translateAny(value, d);
          if (next !== value) el.setAttribute(name, next);
        }
      }
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) translateNode(t, d);
  };

  const translate = (node: Node) => {
    if (dict) return translateNode(node, dict);
    if (waiting) return void waiting.push(node);
    waiting = [node];
    fetch(`/data/ui-strings.json?locale=${locale}`)
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, string>>) : {}))
      .catch(() => ({}))
      .then((rows) => {
        const loaded: Dictionary = new Map(Object.entries(rows));
        dict = loaded;
        for (const n of waiting ?? []) if (n.isConnected) translateNode(n, loaded);
        waiting = null;
      });
  };

  const fixLinks = (root: Element) => {
    const links = root.matches('a[href^="/"]') ? [root] : [];
    for (const a of [...links, ...root.querySelectorAll('a[href^="/"]')]) {
      const href = a.getAttribute('href') ?? '';
      const next = localizeHref(href, locale);
      if (next !== href) a.setAttribute('href', next);
    }
  };

  const hasRussian = (node: Node) => CYRILLIC.test(node.nodeType === Node.ELEMENT_NODE ? (node as Element).outerHTML : (node.nodeValue ?? ''));

  // страница 404 одна на все языки (русская): на /kz/ и /en/ — целиком здесь
  if (needsText && document.documentElement.dataset.locale !== locale) {
    document.documentElement.lang = LANG_CODE[locale];
    document.documentElement.dataset.locale = locale;
    for (const a of document.querySelectorAll('a[href^="/ru"]')) a.setAttribute('href', (a.getAttribute('href') ?? '').replace(/^\/ru(?=\/|$)/, `/${locale}`));
    translate(document.body);
  }

  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') {
        const el = record.target as Element;
        if (record.attributeName === 'href') fixLinks(el);
        else if (needsText && CYRILLIC.test(el.getAttribute(record.attributeName ?? '') ?? '')) translate(el);
      } else if (record.type === 'characterData') {
        if (needsText && hasRussian(record.target)) translate(record.target);
      } else {
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) fixLinks(node as Element);
          if (needsText && hasRussian(node)) translate(node);
        }
      }
    }
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['href', ...TEXT_ATTRS] });
}
