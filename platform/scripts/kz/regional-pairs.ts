/**
 * Чем русская версия живого .kz отличается от содержимого платформы: страница за страницей, строка за строкой.
 * Одинаковые строки служат опорами, строки между опорами сопоставляются по порядку.
 *   npx tsx scripts/kz/regional-pairs.ts [--site=http://127.0.0.1:3400]
 * Итог — exports/kz-pairs.json (в git не попадает): { main, live, pages, products, sample }.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { pageTexts, type PageText } from '@mtpk/content-kit/i18n';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];

const here = import.meta.dirname;
process.loadEnvFile(path.resolve(here, '../../.env'));
const SITE = (process.argv.find((a) => a.startsWith('--site='))?.split('=')[1] ?? 'http://127.0.0.1:3400').replace(/\/$/, '');
const LIVE = path.resolve(here, '../../../exports/kz-live/pages/ru');
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
const bodyTexts = (html: string): PageText[] => {
  const body = find(parse(html), 'body');
  return body ? pageTexts(body.childNodes as Node[]) : [];
};

const sameShape = (a: PageText, b: PageText) => a.kind === b.kind && a.parent === b.parent;

/** Пары различающихся строк: промежутки между одинаковыми строками, где число и вид строк совпадают. */
function diffPairs(a: PageText[], b: PageText[]): [string, string][] {
  const w = b.length + 1;
  const dp = new Uint16Array((a.length + 1) * w);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i * w + j] = a[i]!.text === b[j]!.text ? dp[(i + 1) * w + j + 1]! + 1 : Math.max(dp[(i + 1) * w + j]!, dp[i * w + j + 1]!);
    }
  }
  const out: [string, string][] = [];
  let gapA: PageText[] = [];
  let gapB: PageText[] = [];
  const flush = () => {
    if (gapA.length && gapA.length === gapB.length && gapA.every((x, k) => sameShape(x, gapB[k]!))) {
      gapA.forEach((x, k) => out.push([x.text, gapB[k]!.text]));
    }
    gapA = [];
    gapB = [];
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i]!.text === b[j]!.text) {
      flush();
      i++;
      j++;
    } else if (dp[(i + 1) * w + j]! >= dp[i * w + j + 1]!) gapA.push(a[i++]!);
    else gapB.push(b[j++]!);
  }
  flush();
  return out;
}

const pages = ((await (await fetch(`${process.env.CONTENT_URL}/v1/pages`)).json()) as { path: string; kind: string }[]).filter((p) => p.kind === 'page').map((p) => p.path);
const queue = pages.filter((p) => fs.existsSync(path.join(LIVE, p, 'index.html.gz')));
console.log(`страниц платформы ${pages.length}, из них есть на живом .kz ${queue.length}`);

const pairs = new Map<string, { main: string; live: string; pages: number; products: number; sample: string }>();
async function worker() {
  for (let page = queue.shift(); page; page = queue.shift()) {
    const res = await fetch(`${SITE}/ru${page}`, { redirect: 'manual' });
    if (res.status !== 200) continue;
    const a = bodyTexts(await res.text());
    const b = bodyTexts(zlib.gunzipSync(fs.readFileSync(path.join(LIVE, page, 'index.html.gz'))).toString('utf8'));
    for (const [main, live] of diffPairs(a, b)) {
      if (!CYRILLIC.test(main) && !CYRILLIC.test(live)) continue;
      const key = `${main}\u0000${live}`;
      const row = pairs.get(key) ?? { main, live, pages: 0, products: 0, sample: page };
      row.pages++;
      if (page.startsWith('/products/')) row.products++;
      pairs.set(key, row);
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

const rows = [...pairs.values()].sort((x, y) => y.pages - x.pages);
fs.writeFileSync(path.resolve(here, '../../../exports/kz-pairs.json'), JSON.stringify(rows, null, 1));
console.log(`пар различий: ${rows.length}`);
