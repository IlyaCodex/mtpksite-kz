/**
 * Тексты основного сайта → тексты для Казахстана, прямо в базе дубля (страницы, каталог): реквизиты, география, доставка,
 * сервис, лизинг. Два шага: готовые пары со страниц живого uralinduktor.kz (exports/kz-pairs.json, scripts/kz/regional-pairs.ts) —
 * у этих строк уже есть переводы; затем правила из regional-rules.ts — для всего остального. Повторный запуск ничего не меняет,
 * после новой копии товаров с основного сайта запускается снова.
 *   npx tsx scripts/kz/regionalize.ts [--dry] [--report=файл]
 */
import fs from 'node:fs';
import path from 'node:path';
import { normalizeText } from '@mtpk/content-kit/i18n';
import { createDb } from '@mtpk/db';
import { applyLinks, applyRules, MARKERS, PAIR_MAIN, PAIR_LIVE, REJECT_PAIR } from './regional-rules.ts';

const here = import.meta.dirname;
process.loadEnvFile(path.resolve(here, '../../.env'));
const PAIRS = path.resolve(here, '../../../exports/kz-pairs.json');
const dry = process.argv.includes('--dry');
const reportFile = process.argv.find((a) => a.startsWith('--report='))?.slice(9);

interface Pair {
  main: string;
  live: string;
}

const digits = (s: string) => s.match(/\d+/g) ?? [];
/** Живая страница могла отстать от основной (гарантия 12 месяцев вместо 18): новых чисел в паре быть не должно. */
const safePair = ({ main, live }: Pair) => {
  const known = new Set(digits(main));
  // о компании на живом .kz написано заново: здесь новые числа — её реквизиты
  return (digits(live).every((d) => known.has(d)) || /работает на рынке 13 лет/.test(main)) && !REJECT_PAIR.test(live);
};

const fixes = (s: string) => s.replace(/в регионы Казахстану/g, 'в регионы Казахстана').replace(/в собственных собственных цехах/g, 'в собственных цехах');

const pairs = new Map<string, string>();
const rejected: Pair[] = [];
for (const pair of JSON.parse(fs.readFileSync(PAIRS, 'utf8')) as Pair[]) {
  if (!PAIR_MAIN.test(pair.main) && !PAIR_LIVE.test(pair.live)) continue;
  if (safePair(pair)) pairs.set(pair.main, fixes(pair.live));
  else rejected.push(pair);
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');

const pairHits = new Map<string, number>();
function fromPair(text: string): string | null {
  const key = normalizeText(decode(text));
  const live = key ? pairs.get(key) : undefined;
  if (live === undefined) return null;
  pairHits.set(key, (pairHits.get(key) ?? 0) + 1);
  const lead = /^\s*/.exec(text)![0];
  const tail = /\s*$/.exec(text)![0];
  return lead + live + tail;
}

const ATTR = /\b(alt|title|aria-label|placeholder|data-caption|data-alt)="([^"]*)"/g;
const TEXT_RUN = />([^<]+)</g;

/** Строка значения: готовая пара целиком, текст между тегами и подписи — по парам; затем правила. */
function convert(value: string, useRules: boolean): string {
  const whole = fromPair(value);
  let s = whole ?? value;
  if (whole === null && s.includes('<')) {
    s = s.replace(TEXT_RUN, (all, text: string) => {
      const next = fromPair(text);
      return next === null ? all : `>${next}<`;
    });
    s = s.replace(ATTR, (all, name: string, text: string) => {
      const next = fromPair(text);
      return next === null ? all : `${name}="${next}"`;
    });
  }
  return applyLinks(useRules ? applyRules(s) : s);
}

/** Код, адреса и служебные поля не трогаем. */
const SKIP_KEYS = new Set(['css', 'script', 'code', 'sid', 'href', 'src', 'image', 'cover', 'id', 'type', 'url', 'link', 'name_en']);
const LINK_KEYS = new Set(['href', 'url', 'link']);

function walk<T>(value: T, useRules: boolean, key = ''): T {
  if (typeof value === 'string') return (LINK_KEYS.has(key) ? applyLinks(value) : SKIP_KEYS.has(key) ? value : convert(value, useRules)) as T;
  if (Array.isArray(value)) return value.map((v) => walk(v, useRules, key)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v, useRules, k)])) as T;
  return value;
}

/** Эти страницы заменяет scripts/kz/build-content.ts: в отчёте о них не говорим. */
const OWN_PAGES = /^\/(?:kontakty|o-company|policy|soglasie|proekty|praktikum)\//;

const { db, close } = createDb(process.env.DATABASE_URL!, { max: 4, appName: 'regionalize' });
let changed = 0;
const leftovers = new Map<string, { n: number; where: string }>();
function report(value: unknown, where: string, key = ''): void {
  if (typeof value === 'string') {
    if (SKIP_KEYS.has(key) || !MARKERS.test(value.replace(/&nbsp;|\u00A0/g, ' '))) return;
    const runs = value.includes('<') ? value.replace(/<svg[\s\S]*?<\/svg>/g, ' ').split(/<[^>]+>/) : [value];
    for (const run of runs) {
      const text = normalizeText(decode(run));
      if (!MARKERS.test(text)) continue;
      const known = leftovers.get(text);
      if (known) known.n++;
      else leftovers.set(text, { n: 1, where });
    }
  } else if (Array.isArray(value)) value.forEach((v) => report(v, where, key));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) report(v, where, k);
}

// страницы: новости и отзывы — только пары: Россия и города заказчиков там — сам предмет текста
const pages = await db.page.findMany({ where: { kind: 'page' }, select: { id: true, path: true, title: true, description: true, blocks: true } });
for (const page of pages) {
  const useRules = !/^\/(?:news|otzyvy)\//.test(page.path);
  const next = { title: convert(page.title, useRules), description: page.description && convert(page.description, useRules), blocks: walk(page.blocks, useRules) };
  if (useRules && !OWN_PAGES.test(page.path)) report(next, page.path);
  if (JSON.stringify(next) === JSON.stringify({ title: page.title, description: page.description, blocks: page.blocks })) continue;
  changed++;
  if (!dry) await db.page.update({ where: { id: page.id }, data: { ...next, blocks: next.blocks as object } });
}

// каталог: карточки, подписи
const categories = await db.category.findMany({ select: { id: true, name: true, crumb: true, coverAlt: true, productBlocks: true } });
for (const c of categories) {
  const next = walk({ name: c.name, crumb: c.crumb, coverAlt: c.coverAlt, productBlocks: c.productBlocks }, true);
  report(next, `категория ${c.name}`);
  if (JSON.stringify(next) === JSON.stringify({ name: c.name, crumb: c.crumb, coverAlt: c.coverAlt, productBlocks: c.productBlocks })) continue;
  changed++;
  if (!dry) await db.category.update({ where: { id: c.id }, data: { ...next, productBlocks: next.productBlocks as object } });
}
const subs = await db.subcategory.findMany({ select: { id: true, name: true, crumb: true, coverAlt: true, description: true } });
for (const c of subs) {
  const { id, ...old } = c;
  const next = walk(old, true);
  report(next, `подкатегория ${c.name}`);
  if (JSON.stringify(next) === JSON.stringify(old)) continue;
  changed++;
  if (!dry) await db.subcategory.update({ where: { id }, data: next });
}
const products = await db.product.findMany({
  select: { id: true, name: true, nameNote: true, coverAlt: true, badge: true, origin: true, caption: true, label: true, linkText: true, warranty: true, specs: true, actions: true },
});
for (const p of products) {
  const { id, ...old } = p;
  const next = walk(old, true);
  report(next, `товар ${p.name}`);
  if (JSON.stringify(next) === JSON.stringify(old)) continue;
  changed++;
  if (!dry) await db.product.update({ where: { id }, data: { ...next, specs: next.specs as object, actions: next.actions as object } });
}

console.log(`${dry ? 'было бы изменено' : 'изменено'} записей: ${changed}; готовых пар: ${pairs.size} (применено ${pairHits.size}), отклонено: ${rejected.length}`);
console.log(`строк с российскими привязками осталось: ${leftovers.size}`);
if (reportFile) {
  const rows = [...leftovers.entries()].sort((a, b) => b[1].n - a[1].n).map(([text, { n, where }]) => `${n}\t${where}\t${text}`);
  const refused = rejected.map((p) => `ОТКЛОНЕНО\t${p.main}\t→\t${p.live}`);
  fs.writeFileSync(reportFile, [...rows, '', ...refused].join('\n'));
}
await close();
