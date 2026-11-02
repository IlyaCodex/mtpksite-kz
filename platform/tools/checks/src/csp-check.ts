/**
 * CSP боевого шлюза (infra/gateway/security-headers.conf) на локальной копии сайта «как на домене»:
 * https://uralinduktor.kz в браузере обслуживает локальный сайт, к страницам добавлены заголовки
 * шлюза. Согласие на cookie, прокрутка к карте. Проверяется: счётчик Метрики, Яндекс.Карты, нарушения CSP.
 * Скрипт карты — настоящий; запросы Метрики и Roistat перехватываются без отправки (CSP браузер проверяет раньше),
 * статистика не засоряется. Перед выкладкой правок CSP.
 *
 *   npx tsx tools/checks/src/csp-check.ts [--base=http://127.0.0.1:3400]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { chromiumPath } from './browser.ts';

const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=') as [string, string]));
const LOCAL = (args.get('base') ?? 'http://127.0.0.1:3400').replace(/\/$/, '');
const conf = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../infra/gateway/security-headers.conf'), 'utf8');
const headers: Record<string, string> = {};
for (const m of conf.matchAll(/^add_header\s+(\S+)\s+"([^"]+)"/gm)) headers[m[1].toLowerCase()] = m[2];

// по-настоящему: Яндекс.Карты; остальные сторонние запросы — заглушкой
const REAL = new Set(['api-maps.yandex.ru', 'core-renderer-tiles.maps.yandex.net', 'yastatic.net']);

const allowed = new Map<string, number>();
const browser = await chromium.launch({ executablePath: chromiumPath(), headless: true });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
await context.addInitScript(() => {
  const w = window as unknown as { __csp: string[] };
  w.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => w.__csp.push(`${e.violatedDirective} ← ${e.blockedURI.slice(0, 100)} (${e.sourceFile})`));
});
await context.route('**/*', async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  if (url.hostname === 'uralinduktor.kz') {
    const res = await route.fetch({ url: `${LOCAL}${url.pathname}${url.search}`, maxRedirects: 0 }).catch(() => null);
    if (!res) return route.abort();
    return route.fulfill({ response: res, headers: { ...res.headers(), ...(req.resourceType() === 'document' ? headers : {}) } });
  }
  allowed.set(url.hostname, (allowed.get(url.hostname) ?? 0) + 1);
  if (REAL.has(url.hostname)) return route.continue();
  const js = req.resourceType() === 'script';
  return route.fulfill({ status: js ? 200 : 204, contentType: js ? 'application/javascript' : 'text/plain', body: js ? '/* перехвачено проверкой */' : '' });
});

const page = await context.newPage();
let problems = 0;
for (const p of ['/ru/?utm_source=yandex&utm_medium=cpc&utm_campaign=csp_check', '/kz/', '/ru/kontakty/', '/en/o-company/', '/ru/proekty/', '/kz/products/']) {
  await page.goto(`https://uralinduktor.kz${p}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (await page.locator('#cookie-accept').isVisible().catch(() => false)) await page.click('#cookie-accept');
  const map = page.locator('#projects-map');
  if (await map.count()) await map.scrollIntoViewIfNeeded();
  await page.waitForTimeout(9000);
  const state = await page.evaluate(() => {
    const w = window as unknown as { ym?: { a?: unknown[][] }; ymaps?: unknown; __csp: string[] };
    return {
      ym: (w.ym?.a ?? []).filter((a) => a[1] === 'init').map((a) => a[0]),
      map: document.querySelector('#projects-map') ? typeof w.ymaps : null,
      csp: [...new Set(w.__csp)],
    };
  });
  const bad = state.csp;
  problems += bad.length + (state.ym.length ? 0 : 1);
  console.log(
    `${bad.length ? '✗' : '✓'} ${p.split('?')[0]} — Метрика: ${state.ym.join(', ') || 'нет'}` +
      `${state.map ? `; карта: ${state.map === 'object' ? 'да' : 'нет'}` : ''}; нарушений CSP: ${bad.length}`,
  );
  for (const v of bad) console.log(`    ${v}`);
}
console.log(`сторонние адреса, которые CSP пропустил: ${[...allowed].map(([h, n]) => `${h} (${n})`).join(', ')}`);
await browser.close();
console.log(problems ? `\nпроблем: ${problems}` : '\nCSP шлюза не мешает счётчикам и карте');
process.exit(problems ? 1 : 0);
