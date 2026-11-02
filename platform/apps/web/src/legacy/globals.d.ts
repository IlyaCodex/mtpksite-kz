/**
 * Глобальные объекты, с которыми работают старые скрипты страниц (src/legacy):
 * счётчики аналитики, трекер Битрикс24, общие функции между скриптами,
 * данные карты проектов и API Яндекс.Карт.
 */
export interface Project {
  name: string;
  date?: string;
  city?: string;
  image?: string;
  link?: string;
  ll?: [number, number];
  /** страна (нет — по городу, иначе Россия) */
  country?: string;
}

/** Выбор «К сравнению» (ведёт модуль сайта, см. packages/ui/src/browser/compare-store.ts). */
export interface CompareSelection {
  section: string;
  items: string[];
}
export interface CompareStore {
  read(): CompareSelection | null;
  write(data: CompareSelection): void;
  clear(): void;
  LIMIT?: number;
}

declare global {
  interface Window {
    /** Яндекс.Метрика */
    ym?: (counter: number, method: string, ...args: unknown[]) => void;
    /** Top.Mail.Ru */
    _tmr?: unknown[];
    /** трекер Битрикс24 */
    b24Tracker?: { guest?: { getTrace?: () => string } };
    uiScrollToForm?: (section: Element | null) => boolean;
    refreshMadeBadges?: () => void;
    uiCompare?: CompareStore;
    projects?: Project[];
    /** кейсы реестра проектов (js/cases-data*.js) */
    casesByCategory?: Record<string, unknown[]>;
    TransistorCatalog?: unknown;
  }

  /** Яндекс.Карты 2.1 — без описания типов (подключаются с api-maps.yandex.ru). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ymaps: any;
}
