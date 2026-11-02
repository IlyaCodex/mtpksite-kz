/**
 * Правила каталога, которые раньше жили в клиентских скриптах:
 * диапазоны фильтра (catalog-filter.js) и сопоставление со складом.
 */

/** Бейдж «Сделано в России» на сайте для Казахстана не показывается. */
export function isMadeInRussia(_href: string | undefined): boolean {
  return false;
}

/** slug для сопоставления со складом: '/products/a/b/' → 'a/b' */
export function productSlug(href: string): string | null {
  const m = href.match(/^\/products\/(.+?)\/?$/);
  return m ? m[1].replace(/\/+$/, '') : null;
}

export interface FilterRange {
  v: string;
  l: string;
  short: string;
}
export interface FilterDef {
  label: string;
  anyLabel: string;
  ranges: FilterRange[];
}

/** Известные характеристики для автоматического фильтра каталога. */
export const FILTER_DEFS: Record<string, FilterDef> = {
  mass: {
    label: 'Масса',
    anyLabel: 'любая',
    ranges: [
      { v: 'up-250', l: 'до 250 кг', short: '≤ 250' },
      { v: '250-1000', l: '250 кг — 1 т', short: '250 – 1000' },
      { v: '1000-3000', l: '1 — 3 т', short: '1000 – 3000' },
      { v: '3000-8000', l: '3 — 8 т', short: '3000 – 8000' },
      { v: '8000-15000', l: '8 — 15 т', short: '8000 – 15000' },
    ],
  },
  power: {
    label: 'Мощность',
    anyLabel: 'любая',
    ranges: [
      { v: 'up-25', l: 'до 25 кВт', short: '≤ 25' },
      { v: '25-100', l: '25 — 100 кВт', short: '25 – 100' },
      { v: '100-500', l: '100 — 500 кВт', short: '100 – 500' },
      { v: '500-1500', l: '500 — 1500 кВт', short: '500 – 1500' },
      { v: '1500+', l: 'более 1500 кВт', short: '≥ 1500' },
    ],
  },
  perf: {
    label: 'Производительность',
    anyLabel: 'любая',
    ranges: [
      { v: 'up-1', l: 'до 1 т/час', short: '≤ 1' },
      { v: '1-5', l: '1 — 5 т/час', short: '1 – 5' },
      { v: '5-50', l: '5 — 50 т/час', short: '5 – 50' },
      { v: '50+', l: 'более 50 т/час', short: '≥ 50' },
    ],
  },
};

/** «up-N» → ≤ N, «N-M» → [N, M], «M+» → ≥ M */
export function parseRange(value: string): { min: number; max: number } | null {
  if (!value) return null;
  if (value.startsWith('up-')) return { min: 0, max: parseFloat(value.slice(3)) };
  if (value.endsWith('+')) return { min: parseFloat(value.slice(0, -1)), max: Infinity };
  const parts = value.split('-');
  return parts.length === 2 ? { min: parseFloat(parts[0]), max: parseFloat(parts[1]) } : null;
}

export function pluralizeModels(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} модель`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} модели`;
  return `${n} моделей`;
}

/** Подходит ли карточка (её data-атрибуты) под выбранные значения фильтра. */
export function cardMatches(attrs: Record<string, string> | undefined, active: Record<string, string>): boolean {
  for (const [key, value] of Object.entries(active)) {
    if (!value) continue;
    const raw = attrs?.[`data-${key}`];
    if (raw === undefined || raw === '') return false;
    if (raw === value) continue; // категориальные значения
    const range = parseRange(value);
    const num = parseFloat(raw);
    if (range && !Number.isNaN(num) && num >= range.min && num <= range.max) continue;
    return false;
  }
  return true;
}

/** Ключи автофильтра: известные характеристики, которые есть хотя бы у половины карточек. */
export function detectFilterKeys(cards: { attrs?: Record<string, string> }[]): string[] {
  const counts: Record<string, number> = {};
  for (const c of cards) {
    for (const name of Object.keys(c.attrs ?? {})) {
      const key = name.startsWith('data-') ? name.slice(5) : '';
      if (FILTER_DEFS[key]) counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  const threshold = Math.ceil(cards.length / 2);
  const order = ['mass', 'power', 'perf'];
  return Object.keys(counts)
    .filter((k) => counts[k] >= threshold)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b));
}
