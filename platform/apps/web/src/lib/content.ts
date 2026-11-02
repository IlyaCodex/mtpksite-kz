import type { Dictionary, Locale } from '@mtpk/content-kit/i18n';
import { DEFAULT_SETTINGS, type HolidaySettings, type SiteSettings } from '@mtpk/content-model';
import type { PageDto, PageListItem, RedirectDto, SiteDataDto } from '@mtpk/shared/contracts';

/**
 * Данные сайта из контент-сервиса. Запросы идут при генерации страницы
 * (ISR): готовый HTML кешируется Next.js и перегенерируется по сигналу
 * контент-сервиса (/api/revalidate) или раз в час.
 */
const CONTENT = process.env.CONTENT_URL ?? 'http://127.0.0.1:4101';

async function getJson<T>(path: string): Promise<T | null> {
  const res = await fetch(`${CONTENT}${path}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`контент-сервис: ${res.status} ${path}`);
  return (await res.json()) as T;
}

export const getPage = (path: string) => getJson<PageDto>(`/v1/pages/by-path?path=${encodeURIComponent(path)}`);

/** Словари языков — в памяти процесса: большие, а нужны при генерации каждой страницы. Правка перевода сбрасывает их (/api/revalidate). */
const DICTIONARY_TTL_MS = 5 * 60_000;
const NO_TRANSLATION: Dictionary = new Map();
const dictionaries = new Map<Locale, { at: number; dict: Dictionary }>();

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  if (locale === 'ru') return NO_TRANSLATION;
  const known = dictionaries.get(locale);
  if (known && Date.now() - known.at < DICTIONARY_TTL_MS) return known.dict;
  const dict = new Map(Object.entries((await getJson<Record<string, string>>(`/v1/translations/${locale}`)) ?? {}));
  dictionaries.set(locale, { at: Date.now(), dict });
  return dict;
}

export const resetDictionaries = () => dictionaries.clear();

export async function listPages(): Promise<PageListItem[]> {
  return (await getJson<PageListItem[]>('/v1/pages')) ?? [];
}

export async function listRedirects(): Promise<RedirectDto[]> {
  return (await getJson<RedirectDto[]>('/v1/redirects')) ?? [];
}

/** Настройки сайта (контакты, меню, подвал); контент-сервис недоступен — значения по умолчанию. */
export async function getSettings(): Promise<SiteSettings> {
  try {
    return (await getJson<SiteSettings>('/v1/settings')) ?? DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Праздничные баннеры главной (раздел «Праздники»); контент-сервис недоступен — без праздника. */
export async function getHolidays(): Promise<HolidaySettings | null> {
  try {
    return await getJson<HolidaySettings>('/v1/holidays');
  } catch {
    return null;
  }
}

/** Данные для блоков: наличие на складе и разделы со сравнением. */
export async function getSiteData(): Promise<SiteDataDto> {
  return (await getJson<SiteDataDto>('/v1/site-data')) ?? { stock: {}, compareSections: [] };
}
