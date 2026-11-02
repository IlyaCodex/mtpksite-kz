/**
 * Копия живого uralinduktor.kz — исходник переводов: страниц в исходниках нет, только готовый HTML на сайте.
 *   npx tsx scripts/kz/crawl-live.ts
 * Все адреса карты сайта (три языка), robots.txt и переводы скриптов /js/full-locales/ — сжато в exports/kz-live/
 * (в git не попадает). Уже скачанное пропускает: прерванный запуск продолжается с места остановки.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { setTimeout as wait } from 'node:timers/promises';

const SITE = 'https://uralinduktor.kz';
const OUT = path.resolve(import.meta.dirname, '../../../exports/kz-live');
const WORKERS = 2;
const HEADERS = { 'User-Agent': 'UralInduktor-site-migration/1.0', 'Accept-Encoding': 'gzip' };

async function fetchText(url: string): Promise<{ status: number; text: string; location: string | null }> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS, redirect: 'manual', signal: AbortSignal.timeout(60_000) });
      if ((res.status === 429 || res.status >= 500) && attempt < 4) {
        await wait(5000 * (attempt + 1));
        continue;
      }
      return { status: res.status, text: await res.text(), location: res.headers.get('location') };
    } catch (err) {
      if (attempt >= 4) throw err;
      await wait(5000 * (attempt + 1));
    }
  }
}

const fileFor = (pathname: string) => path.join(OUT, 'pages', pathname.replace(/^\/+|\/+$/g, ''), 'index.html.gz');
const save = (file: string, text: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, zlib.gzipSync(text));
};

const index = await fetchText(`${SITE}/sitemap-index.xml`);
const parts = [...index.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
const urls: string[] = [];
for (const part of parts) urls.push(...[...(await fetchText(part)).text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!));
console.log(`адресов в карте сайта: ${urls.length}`);

const queue = urls.filter((u) => !fs.existsSync(fileFor(new URL(u).pathname)));
console.log(`уже скачано: ${urls.length - queue.length}, осталось: ${queue.length}`);
const problems: string[] = [];
let done = 0;
async function worker() {
  for (let u = queue.shift(); u; u = queue.shift()) {
    const res = await fetchText(u);
    if (res.status === 200) save(fileFor(new URL(u).pathname), res.text);
    else problems.push(`${res.status} ${u}${res.location ? ` -> ${res.location}` : ''}`);
    if (++done % 200 === 0) console.log(`скачано ${done}, осталось ${queue.length}`);
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));

// скрипты с переводами (строки интерфейса) и служебные файлы — как есть
const home = (await fetchText(`${SITE}/kz/`)).text + (await fetchText(`${SITE}/en/`)).text;
const assets = new Set([...home.matchAll(/\/js\/full-locale[^"'?]+\.js/g)].map((m) => m[0]));
for (const file of ['/robots.txt', '/sitemap-index.xml', ...assets]) {
  const res = await fetchText(SITE + file);
  if (res.status === 200) save(path.join(OUT, 'files', `${file.replace(/^\/+/, '')}.gz`), res.text);
  else problems.push(`${res.status} ${file}`);
}
fs.writeFileSync(path.join(OUT, 'problems.txt'), problems.join('\n'));
console.log(`готово: страниц ${done}, файлов ${assets.size + 2}, замечаний ${problems.length}`);
