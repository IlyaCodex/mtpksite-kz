/**
 * SEO-аудит сайта по требованиям Яндекса и Google: все адреса из sitemap и все внутренние ссылки.
 * Страница: код ответа, title и description (наличие, длина, дубли), canonical (свой, https, со слешем),
 * noindex в sitemap, один h1, lang, Open Graph, JSON-LD (разбор, Organization, BreadcrumbList,
 * Product — есть ли offers/review/aggregateRating для товарных сниппетов Google), alt у картинок.
 * Ссылки: битые (4xx/5xx), через редирект, без слеша, .html, на другой домен сайта.
 * Плюс адреса-ловушки: 404, без слеша, index.html, с метками (canonical без меток).
 *
 *   npx tsx tools/checks/src/seo-audit.ts [--site=http://127.0.0.1:3200] [--json=путь] [--examples=5]
 */
import fs from 'node:fs';

const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=') as [string, string]));
const SITE = (args.get('site') ?? 'http://127.0.0.1:3200').replace(/\/$/, '');
const DOMAIN = 'https://uralinduktor.kz';
const EXAMPLES = Number(args.get('examples') ?? 5);

type Issue = { level: 'ошибка' | 'замечание'; code: string; text: string; path: string; detail?: string };
const issues: Issue[] = [];
const add = (level: Issue['level'], code: string, text: string, path: string, detail?: string) => issues.push({ level, code, text, path, detail });

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
const attrs = (tag: string) => Object.fromEntries([...tag.matchAll(/([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)].map((m) => [m[1].toLowerCase(), m[3] ?? m[4] ?? '']));
const tags = (html: string, name: string) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((m) => attrs(m[0]));
const local = (url: string) => (url.startsWith(DOMAIN) ? url.slice(DOMAIN.length) || '/' : url);
/** <head> страницы; без явного </head> (HTML5 это допускает, так свёрстаны рабочие листы) — всё до первого тега тела. */
const headOf = (html: string) => {
  const end = html.search(/<\/head>|<body[\s>]/i);
  if (end >= 0) return html.slice(0, end);
  const body = html.search(/<(?!\/?(?:!doctype|html|head|meta|title|link|style|script|base|noscript)\b)[a-z]/i);
  return body >= 0 ? html.slice(0, body) : html;
};

async function get(path: string): Promise<{ status: number; location: string | null; html: string; robotsHeader: string | null }> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${SITE}${path}`, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (compatible; SEO-audit)' } });
      const html = (res.headers.get('content-type') ?? '').includes('html') ? await res.text() : (await res.arrayBuffer(), '');
      return { status: res.status, location: res.headers.get('location'), html, robotsHeader: res.headers.get('x-robots-tag') };
    } catch (err) {
      if (attempt >= 2) throw err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

// 1. адреса из sitemap
const index = await get('/sitemap-index.xml');
const parts = [...index.html.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => local(m[1]));
const sitemap: string[] = [];
for (const part of parts.length ? parts : ['/sitemap-0.xml']) {
  const res = await fetch(`${SITE}${part}`);
  sitemap.push(...[...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
}
console.log(`в sitemap адресов: ${sitemap.length}`);
for (const url of sitemap) {
  if (!url.startsWith(`${DOMAIN}/`)) add('ошибка', 'sitemap-host', 'адрес в sitemap не на https://uralinduktor.ru', url);
  else if (!local(url).endsWith('/')) add('ошибка', 'sitemap-slash', 'адрес в sitemap без слеша на конце', local(url));
}
if (new Set(sitemap).size !== sitemap.length) add('ошибка', 'sitemap-dupes', 'повторы в sitemap', '/sitemap-0.xml', String(sitemap.length - new Set(sitemap).size));

// 2. страницы
type Page = { path: string; title: string; description: string; h1: string[]; canonical: string; noindex: boolean; links: string[] };
const pages = new Map<string, Page>();
const productsNoOffer: string[] = [];
const schemaTypes = new Map<string, number>();
await pool(sitemap.map(local), 6, async (path) => {
  const r = await get(path);
  if (r.status !== 200) {
    add('ошибка', 'status', `адрес из sitemap отвечает ${r.status}${r.location ? ` → ${r.location}` : ''}`, path);
    return;
  }
  const h = r.html;
  const head = headOf(h);
  const title = decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1] ?? '');
  const metas = tags(head, 'meta');
  const meta = (key: string, val: string) => metas.filter((m) => (m[key] ?? '').toLowerCase() === val).map((m) => decode(m.content ?? ''));
  const description = meta('name', 'description')[0] ?? '';
  const robots = [...meta('name', 'robots'), r.robotsHeader ?? ''].join(',').toLowerCase();
  const canonicals = tags(head, 'link').filter((l) => (l.rel ?? '').toLowerCase() === 'canonical').map((l) => l.href ?? '');
  const h1 = [...h.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => decode(m[1].replace(/<[^>]+>/g, ' ')));
  const noindex = robots.includes('noindex');
  const lang = /<html[^>]*\blang="([^"]+)"/i.exec(h)?.[1];
  const links = [...h.matchAll(/<a\b[^>]*\bhref="([^"#]+)(#[^"]*)?"/gi)].map((m) => decode(m[1]));
  pages.set(path, { path, title, description, h1, canonical: canonicals[0] ?? '', noindex, links });

  if (noindex) add('ошибка', 'noindex-in-sitemap', 'в sitemap, но noindex', path);
  if (!title) add('ошибка', 'title-missing', 'нет title', path);
  else if (title.length > 70) add('замечание', 'title-long', 'title длиннее 70 знаков (Яндекс и Google обрежут)', path, `${title.length}: ${title}`);
  else if (title.length < 15) add('замечание', 'title-short', 'title короче 15 знаков', path, title);
  if (!description) add('ошибка', 'desc-missing', 'нет meta description', path);
  else if (description.length > 170) add('замечание', 'desc-long', 'description длиннее 170 знаков (обрежется в выдаче)', path, `${description.length}`);
  else if (description.length < 50) add('замечание', 'desc-short', 'description короче 50 знаков', path, `${description.length}: ${description}`);
  if (canonicals.length !== 1) add('ошибка', 'canonical-count', `canonical: ${canonicals.length} шт.`, path);
  else if (canonicals[0] !== `${DOMAIN}${path}`) add('ошибка', 'canonical-other', 'canonical не на саму страницу', path, canonicals[0]);
  if (h1.length !== 1) add(h1.length ? 'замечание' : 'ошибка', 'h1-count', `h1 на странице: ${h1.length}`, path, h1.join(' | ').slice(0, 160));
  else if (!h1[0]) add('ошибка', 'h1-empty', 'пустой h1', path);
  if (lang !== 'ru') add('ошибка', 'lang', `html lang="${lang ?? ''}"`, path);
  const og = (p: string) => meta('property', p)[0] ?? '';
  if (!og('og:title') || !og('og:description') || !og('og:image')) add('замечание', 'og-missing', 'неполный Open Graph (title/description/image)', path);
  if (og('og:url') && og('og:url') !== canonicals[0]) add('замечание', 'og-url', 'og:url не совпадает с canonical', path, og('og:url'));
  for (const img of tags(h.slice(head.length), 'img')) if (img.alt === undefined) add('замечание', 'img-alt', 'картинка без alt', path, img.src);

  // JSON-LD
  for (const m of h.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1]);
    } catch {
      add('ошибка', 'jsonld-parse', 'JSON-LD не разбирается', path);
      continue;
    }
    const items = (Array.isArray(data) ? data : [data]).flatMap((d) => ((d as { '@graph'?: unknown[] })['@graph'] ?? [d])) as Record<string, unknown>[];
    for (const item of items) {
      const types = ([] as string[]).concat((item['@type'] as string | string[]) ?? []);
      for (const t of types) schemaTypes.set(t, (schemaTypes.get(t) ?? 0) + 1);
      if (types.includes('Product') && !item.offers && !item.review && !item.aggregateRating) productsNoOffer.push(path);
      if (types.includes('BreadcrumbList')) {
        const list = (item.itemListElement as { position?: number; item?: string | { '@id'?: string }; name?: string }[]) ?? [];
        list.forEach((li, i) => {
          if (li.position !== i + 1) add('ошибка', 'crumbs-position', 'BreadcrumbList: position не по порядку', path);
          const url = typeof li.item === 'string' ? li.item : li.item?.['@id'];
          if (i < list.length - 1 && !url) add('ошибка', 'crumbs-item', 'BreadcrumbList: у звена нет адреса', path, li.name);
          if (url && !url.startsWith(`${DOMAIN}/`)) add('ошибка', 'crumbs-host', 'BreadcrumbList: адрес не на https://uralinduktor.ru', path, url);
        });
      }
      if (types.includes('Article') || types.includes('NewsArticle') || types.includes('BlogPosting')) {
        // у Google все поля статьи рекомендуемые; image — только своя картинка статьи, общую не подставлять
        const missing = ['headline', 'datePublished', 'dateModified', 'author', 'image'].filter((f) => !item[f]);
        if (missing.length) add('замечание', 'article-fields', `Article без ${missing.join(', ')}`, path);
      }
    }
  }
});

// 3. дубли title и description среди индексируемых
const indexable = [...pages.values()].filter((p) => !p.noindex);
for (const [field, code, text] of [['title', 'title-dupe', 'одинаковый title'], ['description', 'desc-dupe', 'одинаковый description']] as const) {
  const groups = new Map<string, string[]>();
  for (const p of indexable) if (p[field]) groups.set(p[field], [...(groups.get(p[field]) ?? []), p.path]);
  for (const [value, paths] of groups) if (paths.length > 1) for (const path of paths) add('замечание', code, `${text} у ${paths.length} страниц`, path, value.slice(0, 90));
}

// 4. внутренние ссылки
const targets = new Map<string, string[]>();
for (const p of pages.values()) {
  for (let href of p.links) {
    if (/^(mailto:|tel:|javascript:|data:)/i.test(href)) continue;
    if (/^https?:\/\/(www\.)?(new\.)?uralinduktor\.ru/i.test(href) && !href.startsWith(DOMAIN)) {
      add('ошибка', 'link-host', 'ссылка на другой вариант домена (http/www/new)', p.path, href);
      continue;
    }
    if (href.startsWith(DOMAIN)) href = local(href);
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    href = href.split('#')[0];
    if (!href) continue;
    targets.set(href, [...(targets.get(href) ?? []), p.path]);
  }
}
const inSitemap = new Set(sitemap.map(local));
const toCheck = [...targets.keys()].filter((t) => !inSitemap.has(t));
const statuses = new Map<string, { status: number; location: string | null; noindex: boolean }>();
await pool(toCheck, 6, async (t) => {
  const r = await get(t).catch(() => ({ status: 0, location: null, html: '', robotsHeader: null }));
  const robots = `${tags(headOf(r.html), 'meta').filter((m) => (m.name ?? '').toLowerCase() === 'robots').map((m) => m.content).join(',')},${r.robotsHeader ?? ''}`;
  statuses.set(t, { status: r.status, location: r.location, noindex: /noindex/i.test(robots) });
});
const NOT_PAGE = /^\/(img|files|docs|og|js|css|assets|fonts|brand|api|r|praktikum\/.+\.(pdf|css|js))\b/;
for (const [t, from] of targets) {
  if (inSitemap.has(t)) continue;
  const s = statuses.get(t)!;
  const where = `${from.length} стр., например ${from[0]}`;
  if (s.status === 0 || s.status >= 400) add('ошибка', 'link-broken', `ссылка ведёт на ${s.status || 'ошибку'}`, t, where);
  else if (s.status >= 300) add('замечание', 'link-redirect', `ссылка через редирект ${s.status} → ${s.location}`, t, where);
  else if (!NOT_PAGE.test(t) && !s.noindex && !/\.(svg|webp|png|jpe?g|gif|avif|pdf|docx?|xlsx?|zip)($|\?)/i.test(t)) {
    if (/\.html?($|\?)/i.test(t)) add('замечание', 'link-html', 'ссылка с .html', t, where);
    else if (!t.split('?')[0].endsWith('/') && !/\.[a-z0-9]{2,5}($|\?)/i.test(t)) add('замечание', 'link-slash', 'ссылка без слеша на конце', t, where);
    else if (!t.includes('?')) add('замечание', 'link-not-in-sitemap', 'страница открывается, но её нет в sitemap', t, where);
  }
}

// 5. адреса-ловушки
const trap = async (path: string, expect: (r: Awaited<ReturnType<typeof get>>) => string | null) => {
  const r = await get(path);
  const problem = expect(r);
  console.log(`  ${problem ? '✗' : '✓'} ${path} → ${r.status}${r.location ? ` ${r.location}` : ''}${problem ? ` — ${problem}` : ''}`);
  if (problem) add('ошибка', 'trap', problem, path);
};
console.log('адреса-ловушки:');
await trap('/net-takoy-stranicy-proverka/', (r) => (r.status === 404 ? null : 'несуществующая страница должна отвечать 404'));
await trap('/kontakty', (r) => (r.status === 301 || r.status === 308 ? (r.location?.endsWith('/kontakty/') ? null : 'редирект не на адрес со слешем') : 'адрес без слеша — постоянный редирект на адрес со слешем'));
await trap('/kontakty/index.html', (r) => (r.status === 301 || r.status === 308 || r.status === 404 ? null : 'index.html не должен отдаваться страницей'));
await trap('/kontakty/?utm_source=test&utm_medium=cpc', (r) => {
  const canonical = tags(headOf(r.html), 'link').find((l) => (l.rel ?? '') === 'canonical')?.href;
  return r.status === 200 && canonical === `${DOMAIN}/kontakty/` ? null : `canonical с метками: ${canonical}`;
});
await trap('/KONTAKTY/', (r) => (r.status === 404 || r.status === 301 || r.status === 308 ? null : 'адрес в другом регистре отдаётся страницей (дубль)'));

// 6. итог
const byCode = new Map<string, Issue[]>();
for (const i of issues) byCode.set(i.code, [...(byCode.get(i.code) ?? []), i]);
console.log(`\nстраниц проверено: ${pages.size}, индексируемых: ${indexable.length}; внутренних адресов в ссылках: ${targets.size}`);
console.log(`разметка JSON-LD: ${[...schemaTypes].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', ')}`);
if (productsNoOffer.length) console.log(`Product без offers/review/aggregateRating: ${productsNoOffer.length} стр. (для товарных сниппетов Google нужно одно из трёх), например ${productsNoOffer[0]}`);
for (const [code, list] of [...byCode].sort((a, b) => (a[1][0].level === b[1][0].level ? b[1].length - a[1].length : a[1][0].level === 'ошибка' ? -1 : 1))) {
  console.log(`\n${list[0].level === 'ошибка' ? '✗' : '!'} ${list[0].text} — ${list.length}`);
  for (const i of list.slice(0, EXAMPLES)) console.log(`    ${i.path}${i.detail ? `  [${i.detail}]` : ''}`);
}
const errors = issues.filter((i) => i.level === 'ошибка').length;
console.log(`\nошибок: ${errors}, замечаний: ${issues.length - errors}`);
if (args.get('json')) fs.writeFileSync(args.get('json')!, JSON.stringify({ issues, productsNoOffer, schemaTypes: Object.fromEntries(schemaTypes) }, null, 1));
process.exit(errors ? 1 : 0);
