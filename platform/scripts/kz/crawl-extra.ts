/**
 * Докачка к копии живого uralinduktor.kz (scripts/kz/crawl-live.ts) того, чего нет в его карте сайта:
 * реестр /proekty/ и страницы кейсов на трёх языках, спасибо, стили страниц (/css/…) и данные скриптов
 * (кейсы и карта проектов). Уже скачанное пропускает.
 *   npx tsx scripts/kz/crawl-extra.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { setTimeout as wait } from 'node:timers/promises';

const SITE = 'https://uralinduktor.kz';
const OUT = path.resolve(import.meta.dirname, '../../../exports/kz-live');
const HEADERS = { 'User-Agent': 'UralInduktor-site-migration/1.0' };
const LANGS = ['ru', 'kz', 'en'];

async function get(url: string): Promise<{ status: number; text: string }> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS, redirect: 'manual', signal: AbortSignal.timeout(60_000) });
      if ((res.status === 429 || res.status >= 500) && attempt < 4) {
        await wait(5000 * (attempt + 1));
        continue;
      }
      return { status: res.status, text: await res.text() };
    } catch (err) {
      if (attempt >= 4) throw err;
      await wait(5000 * (attempt + 1));
    }
  }
}
const save = (file: string, text: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, zlib.gzipSync(text));
};
const read = (file: string) => zlib.gunzipSync(fs.readFileSync(file)).toString('utf8');
const pageFile = (lang: string, p: string) => path.join(OUT, 'pages', lang, p.replace(/^\/+|\/+$/g, ''), 'index.html.gz');

// данные скриптов: кейсы главной и карта проектов (на языках — /js/full-locales/…)
for (const file of ['/js/cases-data.js', '/js/projects-data.js', '/js/full-locales/kz/projects-data.js', '/js/full-locales/en/projects-data.js']) {
  const target = path.join(OUT, 'files', `${file.replace(/^\/+/, '')}.gz`);
  if (fs.existsSync(target)) continue;
  const res = await get(SITE + file);
  if (res.status === 200) save(target, res.text);
  else console.log(`нет ${file}: ${res.status}`);
}

// адреса кейсов — из реестра и из данных главной
const hub = await get(`${SITE}/ru/proekty/`);
const slugs = new Set<string>(['/proekty/', '/spasibo/']);
for (const m of hub.text.matchAll(/href="\/ru(\/proekty\/[^"#?]+\/)"/g)) slugs.add(m[1]!);
for (const m of read(path.join(OUT, 'files/js/cases-data.js.gz')).matchAll(/"slug":\s*"([^"]+)"/g)) slugs.add(`/proekty/${m[1]}/`);
for (const m of read(path.join(OUT, 'files/js/projects-data.js.gz')).matchAll(/"link":\s*"(\/proekty\/[^"]+\/)"/g)) slugs.add(m[1]!);
console.log(`страниц проектов и служебных: ${slugs.size}`);

const queue = [...slugs].flatMap((p) => LANGS.map((lang) => ({ lang, p }))).filter(({ lang, p }) => !fs.existsSync(pageFile(lang, p)));
let done = 0;
const missing: string[] = [];
async function worker() {
  for (let job = queue.shift(); job; job = queue.shift()) {
    const res = await get(`${SITE}/${job.lang}${job.p}`);
    if (res.status === 200) save(pageFile(job.lang, job.p), res.text);
    else missing.push(`${res.status} /${job.lang}${job.p}`);
    if (++done % 100 === 0) console.log(`скачано ${done}, осталось ${queue.length}`);
  }
}
await Promise.all([worker(), worker()]);
console.log(`страниц докачано: ${done}, не открылись: ${missing.length}`);
fs.writeFileSync(path.join(OUT, 'problems-extra.txt'), missing.join('\n'));

// стили, на которые ссылаются страницы своих разделов
const css = new Set<string>();
const scan = (dir: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) scan(full);
    else if (e.name === 'index.html.gz') for (const m of read(full).matchAll(/<link\b[^>]*href="(\/css\/[^"?]+)[^"]*"[^>]*>/g)) css.add(m[1]!);
  }
};
scan(path.join(OUT, 'pages', 'ru'));
for (const file of css) {
  const target = path.join(OUT, 'files', `${file.replace(/^\/+/, '')}.gz`);
  if (fs.existsSync(target)) continue;
  const res = await get(SITE + file);
  if (res.status === 200) save(target, res.text);
}
console.log(`файлов стилей: ${css.size}`);
