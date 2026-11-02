/**
 * Словарь переводов из копии живого uralinduktor.kz (exports/kz-live, scripts/kz/crawl-live.ts):
 * страницы /ru/, /kz/, /en/ одной вёрстки сопоставляются строка за строкой, плюс словарь его скрипта
 * full-locale-runtime.js. Прежние записи origin=live заменяются; правки вручную и машинный перевод не трогаются.
 *   npx tsx scripts/kz/import-translations.ts [--dry]
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { normalizeText, pageTexts, type PageText } from '@mtpk/content-kit/i18n';
import { createDb } from '@mtpk/db';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];

const here = import.meta.dirname;
process.loadEnvFile(path.resolve(here, '../../.env'));
const LIVE = path.resolve(here, '../../../exports/kz-live');
const dry = process.argv.includes('--dry');

const CYRILLIC = /[А-Яа-яЁё]/;
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

interface LivePage {
  texts: PageText[];
  title: string;
  description: string;
}

function load(lang: string, page: string): LivePage | null {
  const file = path.join(LIVE, 'pages', lang, page, 'index.html.gz');
  if (!fs.existsSync(file)) return null;
  const doc = parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'));
  const head = find(doc, 'head');
  const body = find(doc, 'body');
  const titleEl = head && find(head, 'title');
  const title = titleEl ? normalizeText((titleEl.childNodes as DefaultTreeAdapterMap['textNode'][]).map((c) => c.value).join('')) : '';
  let description = '';
  for (const c of (head?.childNodes ?? []) as Node[]) {
    if (isElement(c) && c.tagName === 'meta' && c.attrs.some((a) => a.name === 'name' && a.value === 'description')) {
      description = normalizeText(c.attrs.find((a) => a.name === 'content')?.value ?? '');
    }
  }
  return { texts: body ? pageTexts(body.childNodes as Node[]) : [], title, description };
}

const sameShape = (a: PageText, b: PageText) => a.kind === b.kind && a.parent === b.parent;

/** Пары строк двух версий страницы: вёрстка одна — один к одному; иначе самая длинная общая последовательность, надёжные участки от 4 строк. */
function align(a: PageText[], b: PageText[]): { pairs: [PageText, PageText][]; exact: boolean } {
  if (a.length === b.length && a.every((x, i) => sameShape(x, b[i]!))) return { pairs: a.map((x, i) => [x, b[i]!]), exact: true };
  const w = b.length + 1;
  const dp = new Uint16Array((a.length + 1) * w);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i * w + j] = sameShape(a[i]!, b[j]!) ? dp[(i + 1) * w + j + 1]! + 1 : Math.max(dp[(i + 1) * w + j]!, dp[i * w + j + 1]!);
    }
  }
  const pairs: [PageText, PageText][] = [];
  let run: [PageText, PageText][] = [];
  const flush = () => {
    if (run.length >= 4) pairs.push(...run);
    run = [];
  };
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (sameShape(a[i]!, b[j]!)) {
      run.push([a[i]!, b[j]!]);
      i++;
      j++;
    } else {
      flush();
      if (dp[(i + 1) * w + j]! >= dp[i * w + j + 1]!) i++;
      else j++;
    }
  }
  flush();
  return { pairs, exact: false };
}

const pagesRoot = path.join(LIVE, 'pages', 'ru');
const pages: string[] = [];
(function walkDir(dir: string) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walkDir(path.join(dir, e.name));
    else if (e.name === 'index.html.gz') pages.push(path.relative(pagesRoot, dir).replaceAll(path.sep, '/'));
  }
})(pagesRoot);

type Votes = Map<string, Map<string, number>>;
const votes: Record<'kz' | 'en', Votes> = { kz: new Map(), en: new Map() };
const vote = (lang: 'kz' | 'en', source: string, target: string, weight = 1) => {
  if (!CYRILLIC.test(source) || !target || target === source) return;
  const row = votes[lang].get(source) ?? new Map<string, number>();
  row.set(target, (row.get(target) ?? 0) + weight);
  votes[lang].set(source, row);
};

const stats = { kz: { exact: 0, partial: 0 }, en: { exact: 0, partial: 0 } };
for (const page of pages) {
  const ru = load('ru', page);
  if (!ru) continue;
  for (const lang of ['kz', 'en'] as const) {
    const tr = load(lang, page);
    if (!tr) continue;
    const { pairs, exact } = align(ru.texts, tr.texts);
    stats[lang][exact ? 'exact' : 'partial']++;
    for (const [a, b] of pairs) vote(lang, a.text, b.text);
    vote(lang, ru.title, tr.title);
    vote(lang, ru.description, tr.description);
  }
}

// словарь скрипта прежнего сайта: строки интерфейса, которые вставляют скрипты
const runtime = zlib.gunzipSync(fs.readFileSync(path.join(LIVE, 'files/js/full-locale-runtime.js.gz'))).toString('utf8');
const start = runtime.indexOf('var dict=') + 'var dict='.length;
const dictionary = JSON.parse(runtime.slice(start, runtime.indexOf('[lang];var normal', start))) as Record<'kz' | 'en', Record<string, string>>;
for (const lang of ['kz', 'en'] as const) {
  for (const [source, target] of Object.entries(dictionary[lang])) vote(lang, normalizeText(source), normalizeText(target), 1);
}

const rows: { locale: string; hash: string; source: string; target: string; origin: string }[] = [];
for (const lang of ['kz', 'en'] as const) {
  let conflicts = 0;
  for (const [source, targets] of votes[lang]) {
    if (targets.size > 1) conflicts++;
    const target = [...targets.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    rows.push({ locale: lang, hash: crypto.createHash('sha1').update(source).digest('hex'), source, target, origin: 'live' });
  }
  console.log(`${lang}: страниц один к одному ${stats[lang].exact}, частично ${stats[lang].partial}; строк ${votes[lang].size}, с разными переводами ${conflicts}`);
}

if (dry) process.exit(0);

const { db, close } = createDb(process.env.DATABASE_URL!, { max: 2, appName: 'kz-import-translations' });
await db.translation.deleteMany({ where: { origin: 'live' } });
let saved = 0;
for (let i = 0; i < rows.length; i += 2000) {
  saved += (await db.translation.createMany({ data: rows.slice(i, i + 2000), skipDuplicates: true })).count;
}
console.log(`записано строк: ${saved} (уже были правки: ${rows.length - saved})`);
await close();
