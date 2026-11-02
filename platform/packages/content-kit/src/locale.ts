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

/** Данные для скриптов (сравнение): строки и ключи — по словарю; всё остальное как есть. */
export function translateDeep<T>(value: T, dict: Dictionary): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return translateText(v, dict);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [translateText(k, dict), walk(x)]));
    return v;
  };
  return walk(value) as T;
}
