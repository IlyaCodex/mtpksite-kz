/**
 * Что ещё не переведено: все страницы сайта на русском (локальный сайт) против словаря в базе.
 *   npx tsx scripts/kz/missing-translations.ts [--site=http://127.0.0.1:3400]
 * Итог по разделам — в консоль; список строк с адресом первой встречи — exports/kz-missing.json (в git не попадает).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { headingKeys, normalizeText, pageTexts } from '@mtpk/content-kit/i18n';
import { createDb } from '@mtpk/db';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];

const here = import.meta.dirname;
process.loadEnvFile(path.resolve(here, '../../.env'));
const SITE = (process.argv.find((a) => a.startsWith('--site='))?.split('=')[1] ?? 'http://127.0.0.1:3400').replace(/\/$/, '');
const CONTENT = process.env.CONTENT_URL!;
const CYRILLIC = /[А-Яа-яЁё]/;
const WORKERS = 4;

const isElement = (n: Node): n is Element => 'tagName' in n;
const find = (n: Element | DefaultTreeAdapterMap['document'], tag: string): Element | undefined => {
  for (const c of n.childNodes as Node[]) {
    if (!isElement(c)) continue;
    if (c.tagName === tag) return c;
    const deep = find(c, tag);
    if (deep) return deep;
  }
  return undefined;
};

const { db, close } = createDb(process.env.DATABASE_URL!, { max: 2, appName: 'kz-missing-translations' });
const known = { kz: new Set<string>(), en: new Set<string>() };
for (const t of await db.translation.findMany({ select: { locale: true, source: true } })) known[t.locale as 'kz' | 'en']?.add(t.source);
await close();

const pages = ((await (await fetch(`${CONTENT}/v1/pages`)).json()) as { path: string; kind: string }[]).filter((p) => p.kind === 'page').map((p) => p.path);
const section = (p: string) => {
  const seg = p.split('/').filter(Boolean);
  return seg[0] === 'products' ? (seg[1] ? `products/${seg[1]}` : 'products') : (seg[0] ?? '(главная)');
};

interface Row {
  source: string;
  page: string;
  count: number;
}
const missing = { kz: new Map<string, Row>(), en: new Map<string, Row>() };
const totals = new Map<string, { chars: number; kz: number; en: number }>();
const seen = new Set<string>();
const queue = [...pages];
let failed = 0;

function take(page: string, text: string) {
  if (!CYRILLIC.test(text)) return;
  const first = !seen.has(text);
  seen.add(text);
  const row = totals.get(section(page)) ?? { chars: 0, kz: 0, en: 0 };
  if (first) row.chars += text.length;
  for (const lang of ['kz', 'en'] as const) {
    if (known[lang].has(text)) continue;
    const m = missing[lang].get(text);
    if (m) m.count++;
    else {
      missing[lang].set(text, { source: text, page, count: 1 });
      row[lang] += text.length;
    }
  }
  totals.set(section(page), row);
}

/** Текстовые поля разметки JSON-LD: их переводит localizeJsonLd целой строкой. */
function jsonLdTexts(value: unknown): string[] {
  if (typeof value === 'string') return /^https?:/.test(value) ? [] : [normalizeText(value)];
  if (Array.isArray(value)) return value.flatMap(jsonLdTexts);
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => (k.startsWith('@') ? [] : jsonLdTexts(v)));
  return [];
}

async function worker() {
  for (let page = queue.shift(); page; page = queue.shift()) {
    const res = await fetch(`${SITE}/ru${page}`, { redirect: 'manual' });
    if (res.status !== 200) {
      failed++;
      continue;
    }
    const doc = parse(await res.text());
    const head = find(doc, 'head');
    const title = head && find(head, 'title');
    if (title) take(page, normalizeText((title.childNodes as DefaultTreeAdapterMap['textNode'][]).map((c) => c.value).join('')));
    for (const c of (head?.childNodes ?? []) as Node[]) {
      if (isElement(c) && c.tagName === 'meta' && c.attrs.some((a) => a.name === 'name' && a.value === 'description')) take(page, normalizeText(c.attrs.find((a) => a.name === 'content')?.value ?? ''));
    }
    for (const c of (head?.childNodes ?? []) as Node[]) {
      if (isElement(c) && c.tagName === 'script' && c.attrs.some((x) => x.name === 'type' && x.value === 'application/ld+json')) {
        const raw = (c.childNodes as DefaultTreeAdapterMap['textNode'][]).map((x) => x.value).join('');
        jsonLdTexts(JSON.parse(raw)).forEach((text) => take(page, text));
      }
    }
    const body = find(doc, 'body');
    if (body) {
      for (const t of pageTexts(body.childNodes as Node[])) take(page, t.text);
      for (const key of headingKeys(body.childNodes as Node[])) take(page, key);
    }
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));

const chars = (m: Map<string, Row>) => [...m.keys()].reduce((n, s) => n + s.length, 0);
console.log(`страниц ${pages.length}${failed ? `, не открылись ${failed}` : ''}; разных русских строк ${seen.size}, знаков ${[...seen].reduce((n, s) => n + s.length, 0)}`);
for (const lang of ['kz', 'en'] as const) console.log(`без перевода ${lang}: строк ${missing[lang].size}, знаков ${chars(missing[lang])}`);
console.log('раздел | знаков новых строк | без перевода kz | en');
for (const [name, r] of [...totals.entries()].sort((a, b) => b[1].kz - a[1].kz)) console.log(`${name} | ${r.chars} | ${r.kz} | ${r.en}`);
fs.writeFileSync(
  path.resolve(here, '../../../exports/kz-missing.json'),
  JSON.stringify({ kz: [...missing.kz.values()].sort((a, b) => b.count - a.count), en: [...missing.en.values()].sort((a, b) => b.count - a.count) }, null, 1),
);
