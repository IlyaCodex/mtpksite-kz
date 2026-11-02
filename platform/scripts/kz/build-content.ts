/**
 * Содержимое сайта для Казахстана в базе дубля. Товары и описания — как на основном сайте (тексты приводит к Казахстану
 * scripts/kz/regionalize.ts); свои страницы и блоки — со страниц живого uralinduktor.kz (копия exports/kz-live):
 * первый экран про Астану, приветствие директора, география, контакты, О компании, юридические страницы, проекты.
 * Работает через API контент-сервиса и медиасервиса (локально: 4201, 4204); повторный запуск приводит к тому же результату.
 * Новые картинки — только под img/kz/ общего хранилища: файлы основного сайта не трогает.
 *   npx tsx scripts/kz/build-content.ts [--only=settings,home,own,cleanup,seo]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { parse, parseFragment, serializeOuter, type DefaultTreeAdapterMap } from 'parse5';
import postcss, { type AtRule, type Rule } from 'postcss';
import { createDb } from '@mtpk/db';
import { applyLinks, applyRules } from './regional-rules.ts';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
type Document = DefaultTreeAdapterMap['document'];
type Block = Record<string, unknown> & { type: string };

const here = import.meta.dirname;
const PLATFORM = path.resolve(here, '../..');
process.loadEnvFile(path.join(PLATFORM, '.env'));
const LIVE = path.resolve(PLATFORM, '../exports/kz-live');
const HOME_SOURCE = path.resolve(PLATFORM, '../exports/kz-home-source.json');
const LEGACY = path.join(PLATFORM, 'apps/web/src/legacy');
const CONTENT = process.env.CONTENT_API ?? 'http://127.0.0.1:4201';
const MEDIA = process.env.MEDIA_API ?? 'http://127.0.0.1:4204';
const SITE = 'https://uralinduktor.kz';
const auth = { 'x-admin-token': process.env.ADMIN_TOKEN! };

const { db, close } = createDb(process.env.DATABASE_URL!, { max: 4, appName: 'build-content' });

// ── Копия живого сайта ──────────────────────────────────────────────

const gunzip = (file: string) => zlib.gunzipSync(fs.readFileSync(file)).toString('utf8');
const livePageFile = (p: string, lang = 'ru') => path.join(LIVE, 'pages', lang, p.replace(/^\/+|\/+$/g, ''), 'index.html.gz');
const liveHtml = (p: string, lang = 'ru') => gunzip(livePageFile(p, lang));

async function liveFile(file: string): Promise<string> {
  const copy = path.join(LIVE, 'files', `${file.replace(/^\/+/, '')}.gz`);
  if (fs.existsSync(copy)) return gunzip(copy);
  const res = await fetch(SITE + file, { headers: { 'User-Agent': 'UralInduktor-site-migration/1.0' } });
  if (!res.ok) throw new Error(`${file}: ${res.status}`);
  const text = await res.text();
  fs.mkdirSync(path.dirname(copy), { recursive: true });
  fs.writeFileSync(copy, zlib.gzipSync(text));
  return text;
}

const isElement = (n: Node): n is Element => 'tagName' in n;
const attr = (el: Element, name: string) => el.attrs.find((a) => a.name === name)?.value ?? '';
function find(root: Element | Document, test: (el: Element) => boolean): Element | undefined {
  for (const c of root.childNodes as Node[]) {
    if (!isElement(c)) continue;
    if (test(c)) return c;
    const deep = find(c, test);
    if (deep) return deep;
  }
  return undefined;
}
function findAll(root: Element | Document, test: (el: Element) => boolean, out: Element[] = []): Element[] {
  for (const c of root.childNodes as Node[]) {
    if (!isElement(c)) continue;
    if (test(c)) out.push(c);
    findAll(c, test, out);
  }
  return out;
}
const textOf = (el: Element): string => (el.childNodes as Node[]).map((c) => ('value' in c ? (c.value as string) : isElement(c) ? textOf(c) : '')).join('');

interface LivePage {
  doc: Document;
  main: Element;
  title: string;
  description: string;
  /** стили страницы: свои (в разметке страницы и её файлы) и общие живого сайта */
  css: () => Promise<{ own: string[]; shared: string[] }>;
}

function livePage(p: string): LivePage {
  const doc = parse(liveHtml(p));
  const main = find(doc, (el) => el.tagName === 'main');
  if (!main) throw new Error(`нет <main>: ${p}`);
  const titleTag = find(doc, (el) => el.tagName === 'title');
  const meta = find(doc, (el) => el.tagName === 'meta' && attr(el, 'name') === 'description');
  const title = titleTag ? textOf(titleTag).trim() : '';
  const description = meta ? attr(meta, 'content') : '';
  return {
    doc,
    main,
    title,
    description,
    css: async () => {
      const inMain = findAll(main, (el) => el.tagName === 'style');
      const inHead = findAll(doc, (el) => el.tagName === 'style' && !inMain.includes(el)).map(textOf);
      const links = findAll(doc, (el) => el.tagName === 'link' && attr(el, 'rel') === 'stylesheet').map((el) => attr(el, 'href').split('?')[0]!);
      const files = links.filter((href) => href.startsWith('/css/') && href !== '/css/site.css');
      return {
        own: [...(await Promise.all(files.map(liveFile))), ...inMain.map(textOf)],
        shared: [await liveFile('/css/site.css'), ...inHead],
      };
    },
  };
}

// ── Картинки ────────────────────────────────────────────────────────

const assetCache = new Map<string, string>();
/** Адрес файла на этом сайте: уже в общем хранилище — как есть, иначе копируем с живого сайта под img/kz/. */
async function ensureAsset(url: string): Promise<string> {
  const known = assetCache.get(url);
  if (known !== undefined) return known;
  const key = url.replace(/^\//, '');
  if (await db.asset.findUnique({ where: { key }, select: { key: true } })) {
    assetCache.set(url, url);
    return url;
  }
  const target = key.replace(/^(img|files|docs)\//, '$1/kz/');
  if (await db.asset.findUnique({ where: { key: target }, select: { key: true } })) {
    assetCache.set(url, `/${target}`);
    return `/${target}`;
  }
  const res = await fetch(SITE + url, { headers: { 'User-Agent': 'UralInduktor-site-migration/1.0' } });
  if (!res.ok || (res.headers.get('content-type') ?? '').startsWith('text/html')) {
    console.warn(`нет файла на живом сайте: ${url} (${res.status})`);
    assetCache.set(url, '');
    return '';
  }
  const body = Buffer.from(await res.arrayBuffer());
  const put = await fetch(`${MEDIA}/admin/v1/objects/${target}`, { method: 'PUT', body, headers: { ...auth, 'content-type': 'application/octet-stream' } });
  if (!put.ok) throw new Error(`загрузка ${target}: ${put.status} ${await put.text()}`);
  const { url: saved } = (await put.json()) as { url: string };
  console.log(`файл загружен: ${saved}`);
  assetCache.set(url, saved);
  return saved;
}

/** Все адреса файлов в HTML или CSS — на этом сайте. */
async function localizeAssets(s: string): Promise<string> {
  const urls = new Set(s.match(/\/(?:img|files|docs)\/[^"'\s)?#,;&]+/g) ?? []);
  let out = s;
  for (const url of urls) {
    const next = await ensureAsset(url);
    if (next && next !== url) out = out.split(url).join(next);
  }
  return out;
}

// ── Стили страниц живого сайта ─────────────────────────────────────

const classesIn = (selector: string) => [...selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]!);
const STATE = /^(?:is|has)-/;

/** Классы, у которых на сайте уже есть оформление (общие стили): их правила с живого сайта не берём. */
function coreClasses(): Set<string> {
  const known = new Set<string>();
  for (const dir of ['apps/web/public/css', 'apps/web/src/styles']) {
    for (const f of fs.readdirSync(path.join(PLATFORM, dir))) {
      if (!f.endsWith('.css')) continue;
      postcss.parse(fs.readFileSync(path.join(PLATFORM, dir, f), 'utf8')).walkRules((rule) => {
        for (const c of classesIn(rule.selector)) known.add(c);
      });
    }
  }
  return known;
}
const CORE = coreClasses();

const usedClasses = (html: string) => new Set([...html.matchAll(/\bclass="([^"]*)"/g)].flatMap((m) => m[1]!.split(/\s+/).filter(Boolean)));

/**
 * Из стилей живой страницы — только правила для классов этой разметки: свои стили страницы целиком (раньше общих
 * стилей сайта в каскаде — поэтому с приставкой main), из общих — то, чего нет в общих стилях этого сайта.
 */
function extractCss(sources: { own: string[]; shared: string[] }, html: string): string {
  const used = usedClasses(html);
  const out: string[] = [];
  const animations = new Set<string>();
  const list = [...sources.shared.map((css) => ({ css, own: false })), ...sources.own.map((css) => ({ css, own: true }))];
  for (const { css: source, own } of list) {
    const root = postcss.parse(source.replace(/<!--|-->/g, ''));
    const frames: AtRule[] = [];
    root.walk((node) => {
      if (node.type === 'atrule' && /keyframes$/.test(node.name)) frames.push(node);
    });
    frames.forEach((f) => f.remove());
    root.walkRules((rule: Rule) => {
      const keep = rule.selectors.filter((sel) => {
        const classes = classesIn(sel).filter((c) => !STATE.test(c));
        return classes.length > 0 && classes.every((c) => used.has(c)) && (own || classes.some((c) => !CORE.has(c)));
      });
      if (!keep.length) return void rule.remove();
      rule.selectors = own ? keep.map((sel) => `main ${sel}`) : keep;
      rule.walkDecls(/^animation(-name)?$/, (d) => {
        for (const word of d.value.split(/[\s,]+/)) animations.add(word);
      });
    });
    root.walkAtRules((at) => {
      if (at.name === 'font-face' || at.name === 'import' || at.name === 'charset') at.remove();
      else if (at.nodes && !at.nodes.length) at.remove();
    });
    // пустые обёртки после удаления вложенных правил
    root.walkAtRules((at) => {
      if (at.nodes && !at.nodes.some((n) => n.type !== 'comment')) at.remove();
    });
    root.walkComments((c) => void c.remove());
    const css = root.toString().trim().replace(/"Inter SEO"/g, 'Inter');
    if (css) out.push(css);
    for (const f of frames) if (animations.has(f.params)) out.push(f.toString());
  }
  return out.join('\n');
}

// ── Разметка живых страниц → блоки ─────────────────────────────────

/** Общие секции сайта: компоненты вместо копий разметки. */
const SHARED_SECTIONS: Record<string, Block> = {
  'best-offer': { type: 'bestOffer' },
  leadgen: { type: 'leadgen' },
  partner: { type: 'partner' },
  adv: { type: 'adv' },
  'why-us': { type: 'whyUs' },
};

function stripLocale(html: string): string {
  return html.replace(/\b(href|action|data-href)="\/(?:ru|kz|en)(\/[^"]*)"/g, '$1="$2"');
}

/** Форма заявки в секции — тегом <ui-form>, оформление и отправка — компонента сайта. */
function replaceForms(el: Element): void {
  for (const form of findAll(el, (x) => x.tagName === 'form')) {
    const cls = attr(form, 'class');
    const name = attr(form, 'data-form');
    if (!cls.includes('hero-quick-card__form')) throw new Error(`неизвестная форма: ${cls} (${name})`);
    const tag = parseFragment(`<ui-form type="express" name="${name}"></ui-form>`).childNodes[0] as Element;
    const parent = form.parentNode as Element;
    const at = parent.childNodes.indexOf(form);
    tag.parentNode = parent;
    parent.childNodes[at] = tag;
  }
}

async function sectionHtml(el: Element): Promise<string> {
  replaceForms(el);
  // страница кейса на живом сайте — <main> внутри <main>
  if (el.tagName === 'main') {
    el.tagName = 'div';
    el.nodeName = 'div';
  }
  return localizeAssets(stripLocale(serializeOuter(el)));
}

/** Секции главной колонки живой страницы: html-блоки, общие секции — компонентами. */
async function liveBlocks(page: LivePage, opts: { skip?: (cls: string) => boolean; swap?: Record<string, Block> } = {}): Promise<{ blocks: Block[]; html: string }> {
  const blocks: Block[] = [];
  let html = '';
  for (const child of page.main.childNodes as Node[]) {
    if (!isElement(child) || child.tagName === 'style' || child.tagName === 'script') continue;
    const cls = attr(child, 'class').split(/\s+/)[0] ?? '';
    if (opts.skip?.(cls)) continue;
    if (opts.swap?.[cls]) {
      blocks.push(opts.swap[cls]!);
      continue;
    }
    if (SHARED_SECTIONS[cls]) {
      blocks.push(SHARED_SECTIONS[cls]!);
      continue;
    }
    const part = await sectionHtml(child);
    html += part;
    blocks.push({ type: 'html', html: part });
  }
  return { blocks, html };
}

// ── API контент-сервиса ─────────────────────────────────────────────

async function api<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(CONTENT + url, {
    method,
    headers: body === undefined ? auth : { ...auth, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${(await res.text()).slice(0, 600)}`);
  return (await res.json()) as T;
}

interface PageFields {
  path: string;
  title: string;
  description: string | null;
  noindex: boolean;
  status: string;
  template: string;
  preloadImage: string | null;
  cssTemplates: string[];
  inlineStyles: string[];
  blocks: Block[];
}

async function savePage(fields: Partial<PageFields> & { path: string; title: string; blocks: Block[] }): Promise<void> {
  const known = await db.page.findUnique({ where: { path: fields.path }, select: { id: true } });
  const body = { noindex: false, status: 'published', template: 'page', preloadImage: null, cssTemplates: [], inlineStyles: [], description: null, ...fields };
  if (known) await api('PUT', `/admin/v1/pages/${known.id}`, body);
  else await api('POST', '/admin/v1/pages', body);
}

const styled = (css: string): Block[] => (css ? [{ type: 'style', css }] : []);

// ── Данные скриптов: кейсы и карта проектов ─────────────────────────

const COUNTRY_BY_CITY: Record<string, string> = {
  Алматы: 'Казахстан', Актобе: 'Казахстан', Астана: 'Казахстан', Атырау: 'Казахстан', Караганда: 'Казахстан', Костанай: 'Казахстан', Павлодар: 'Казахстан',
  Темиртау: 'Казахстан', Уральск: 'Казахстан', 'Усть-Каменогорск': 'Казахстан', Шымкент: 'Казахстан', Экибастуз: 'Казахстан',
  Ташкент: 'Узбекистан', Самарканд: 'Узбекистан', Навои: 'Узбекистан', Алмалык: 'Узбекистан', Бекабад: 'Узбекистан',
  Бишкек: 'Кыргызстан', Душанбе: 'Таджикистан', Ереван: 'Армения', Минск: 'Беларусь', Гомель: 'Беларусь',
};

const loadWindowJson = <T>(js: string): T => {
  const body = js.slice(js.indexOf('=') + 1);
  return JSON.parse(body.slice(0, body.search(/;\s*(?:window\.|$)/))) as T;
};

interface CaseRow {
  slug: string;
  title: string;
  image?: string;
  city?: string;
  date?: string;
  type?: string;
  [key: string]: unknown;
}
type CasesByCategory = Record<string, CaseRow[]>;
interface ProjectRow {
  name: string;
  city?: string;
  image?: string;
  link?: string;
  country?: string;
  [key: string]: unknown;
}

const dataFile = (variable: string, value: unknown, about: string) =>
  `/* ${about} (создаёт scripts/kz/build-content.ts со страниц живого uralinduktor.kz, вручную не править). */\nwindow.${variable} = ${JSON.stringify(value)} as never;\n`;

async function buildScriptData(): Promise<CasesByCategory> {
  const sources = { '': '/js/cases-data.js', '-kz': '/js/full-locales/kz/cases-data.js', '-en': '/js/full-locales/en/cases-data.js' };
  const images = new Map<string, string>();
  let russian: CasesByCategory = {};
  for (const [suffix, file] of Object.entries(sources)) {
    const data = loadWindowJson<CasesByCategory>(await liveFile(file));
    for (const list of Object.values(data)) {
      for (const row of list) {
        if (row.image && !images.has(row.image)) images.set(row.image, await ensureAsset(row.image));
        row.image = (row.image && images.get(row.image)) || '';
      }
    }
    if (!suffix) russian = data;
    fs.writeFileSync(path.join(LEGACY, `cases-data${suffix}.ts`), dataFile('casesByCategory', data, 'Кейсы для реестра проектов'));
  }

  // карта проектов: фото — с кейса (на живом сайте адреса старого сайта не открываются), страна — у каждого проекта
  const caseImage = new Map(Object.values(russian).flat().map((c) => [c.slug, c.image ?? '']));
  const ruRows = loadWindowJson<ProjectRow[]>(await liveFile('/js/projects-data.js'));
  const projectFiles = { '': ruRows, '-kz': loadWindowJson<ProjectRow[]>(await liveFile('/js/full-locales/kz/projects-data.js')), '-en': loadWindowJson<ProjectRow[]>(await liveFile('/js/full-locales/en/projects-data.js')) };
  for (const [suffix, rows] of Object.entries(projectFiles)) {
    if (rows.length !== ruRows.length) throw new Error(`projects-data${suffix}: ${rows.length} строк вместо ${ruRows.length}`);
    const out = rows.map((row, i) => {
      const ru = ruRows[i]!;
      const slug = /\/proekty\/([^/]+)\/$/.exec(ru.link ?? '')?.[1] ?? '';
      const link = slug ? `/${suffix ? suffix.slice(1) : 'ru'}/proekty/${slug}/` : undefined;
      return { ...row, link, image: caseImage.get(slug) || undefined, country: COUNTRY_BY_CITY[ru.city ?? ''] ?? 'Россия' };
    });
    fs.writeFileSync(path.join(LEGACY, `projects-data${suffix}.ts`), dataFile('projects', out, 'Проекты на карте'));
  }
  return russian;
}

const DATA_VERSION = '20261102';

/** Скрипт на языке страницы: данные и карта Яндекса грузятся, когда карта подошла к экрану. */
const MAP_LOADER = `(function(){
  var el = document.getElementById('projects-map');
  if (!el) return;
  var lang = (location.pathname.match(/^\\/(kz|en)\\//) || [])[1];
  var loaded = false;
  function loadMap(){
    if (loaded) return;
    loaded = true;
    var files = ['/js/projects-data' + (lang ? '-' + lang : '') + '.js?v=${DATA_VERSION}', 'https://api-maps.yandex.ru/2.1/?lang=' + (lang === 'en' ? 'en_US' : 'ru_RU'), '/js/projects-map.js?v=${DATA_VERSION}'];
    files.forEach(function(src){
      var s = document.createElement('script');
      s.src = src;
      s.async = false; // порядок: данные → API → карта
      document.body.appendChild(s);
    });
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting) { loadMap(); io.disconnect(); }
      });
    }, { rootMargin: '300px' });
    io.observe(el);
  } else {
    loadMap();
  }
})();
`;

// ── Блоки главной ───────────────────────────────────────────────────

const replaceOrThrow = (s: string, re: RegExp, to: string): string => {
  if (!re.test(s)) throw new Error(`не нашлось в блоке: ${String(re)}`);
  return s.replace(re, to);
};

/** География: вид — с основного сайта, тексты и страны — с живого .kz, данные — js/projects-data*. */
function geomapBlock(source: Block): Block {
  let html = source.html as string;
  html = replaceOrThrow(html, /<h2 class="geomap__title">[\s\S]*?<\/h2>/, '<h2 class="geomap__title">Работаем по Казахстану и <em>в странах СНГ</em></h2>');
  html = replaceOrThrow(html, /<p class="geomap__lead">[\s\S]*?<\/p>/, '<p class="geomap__lead">340+ внедрений в разных регионах. Комплектуем проекты, запускаем оборудование на площадке заказчика и поддерживаем сервис.</p>');
  html = replaceOrThrow(
    html,
    /<div class="geomap__filters"[\s\S]*?<\/div>/,
    `<div class="geomap__filters" role="group" aria-label="Страна"> <button type="button" class="geomap__filter is-active" data-geo-country="" aria-pressed="true">Все проекты</button> ${['Казахстан', 'Россия', 'Узбекистан', 'Кыргызстан', 'Таджикистан', 'Армения', 'Беларусь']
      .map((c) => `<button type="button" class="geomap__filter" data-geo-country="${c}" aria-pressed="false" hidden>${c}</button>`)
      .join(' ')} </div>`,
  );
  html = replaceOrThrow(html, /aria-label="Карта реализованных проектов[^"]*"/, 'aria-label="Карта реализованных проектов УралИндуктор по Казахстану и странам СНГ"');
  return { ...source, html };
}

const KZ_CITIES = ['Караганда', 'Актобе', 'Шымкент', 'Алматы', 'Астана', 'Костанай', 'Темиртау', 'Усть-Каменогорск', 'Атырау', 'Уральск', 'Экибастуз'];
const PAVLODAR = '/proekty/postavka-ui-1t-800kw-uig-80t-pavlodar/';
const RYBINSK = 'postavka-drobemetnoy-ustanovki-uid-3210-rybinsk';

const escapeAttr = (s: string) => s.replace(/&(?!\w+;)/g, '&amp;').replace(/"/g, '&quot;');

/** «Реализованные проекты»: вид — с основного сайта, проекты — кейсы этого сайта; Казахстан первым. */
function worksBlock(source: Block, cases: CasesByCategory): Block {
  const all = Object.values(cases).flat().filter((c) => c.image && c.city);
  const seen = new Set<string>();
  const unique = all.filter((c) => (seen.has(c.slug) ? false : (seen.add(c.slug), true)));
  const byDate = (c: CaseRow) => (c.date ?? '').split('.').reverse().join('');
  const kz = unique.filter((c) => KZ_CITIES.includes(c.city!) && `/proekty/${c.slug}/` !== PAVLODAR);
  const rybinsk = unique.filter((c) => c.slug === RYBINSK);
  const fresh = [...unique].sort((a, b) => byDate(b).localeCompare(byDate(a))).filter((c) => !kz.includes(c) && !rybinsk.includes(c) && `/proekty/${c.slug}/` !== PAVLODAR);
  const picks = [...kz, ...rybinsk, ...fresh].slice(0, 8);
  const cards = picks
    .map(
      (c) => `<li class="works__item"> <a class="work-card" href="/proekty/${c.slug}/"> <div class="work-card__photo"><img src="${c.image}" width="640" height="420" alt="${escapeAttr(c.title)}" loading="lazy" decoding="async"></div> <div class="work-card__body"> <div class="work-card__meta"><span>${c.city}</span> · ${c.date ?? ''}</div> <h4 class="work-card__title">${c.title}</h4> <span class="work-card__link">Смотреть проект <span class="work-card__arrow" aria-hidden="true"></span></span> </div> </a> </li>`,
    )
    .join(' ');
  let html = source.html as string;
  html = replaceOrThrow(html, /<p class="works__lead">[\s\S]*?<\/p>/, '<p class="works__lead">340+ внедрений по Казахстану и странам СНГ. Литейные производства, металлургические и машиностроительные предприятия.</p>');
  html = replaceOrThrow(
    html,
    /<article class="works-main">[\s\S]*?<\/article>/,
    `<article class="works-main"> <a class="works-main__photo" href="${PAVLODAR}" tabindex="-1" aria-hidden="true"><img src="/img/proekty/pavlodar/photo-01.webp" alt="" loading="lazy" decoding="async"></a> <div class="works-main__body"> <span class="works-main__tag">Индукционная плавка</span> <div class="works-main__meta"><span>Павлодар, Казахстан</span> · 27.07.2026</div> <h3 class="works-main__title"><a href="${PAVLODAR}">Поставка индукционной плавильной печи UI-1Т-800KW и станции охлаждения УИГ-80Т</a></h3> <a class="btn btn--primary" href="${PAVLODAR}">Подробнее о&nbsp;проекте <span class="btn__arrow" aria-hidden="true">→</span></a> </div> </article>`,
  );
  html = replaceOrThrow(html, /<ul class="works__track">[\s\S]*<\/ul>/, `<ul class="works__track"> ${cards} </ul>`);
  return { ...source, html };
}

/** «Сервис»: на основном сайте два телефона, здесь один номер. */
function careBlock(source: Block): Block {
  return { ...source, html: replaceOrThrow(source.html as string, /(<a href="tel:\+77758534095">[^<]*<\/a>)\s*<a href="tel:\+77758534095">[^<]*<\/a>/, '$1') };
}

async function buildHome(cases: CasesByCategory): Promise<void> {
  const page = livePage('/');
  const sections = new Map<string, Element>();
  for (const child of page.main.childNodes as Node[]) {
    if (isElement(child) && child.tagName === 'section') sections.set(attr(child, 'class').split(/\s+/)[0]!, child);
  }
  const hero = await sectionHtml(sections.get('hk-hero')!);
  const greet = await sectionHtml(sections.get('greet')!);
  // «Гарантийные условия»: у секции свой фон и поля, под ней — фон страницы (фон body тёмный)
  const quotation = `<div style="background:var(--surface-page);padding:var(--sp-1) 0">${await sectionHtml(sections.get('seo-quotation')!)}</div>`;
  const css = await localizeAssets(extractCss(await page.css(), hero + greet + quotation));

  // блоки основного сайта — из их копии (тексты уже приведены к Казахстану)
  if (!fs.existsSync(HOME_SOURCE)) {
    const row = await db.page.findUnique({ where: { path: '/' }, select: { blocks: true } });
    fs.writeFileSync(HOME_SOURCE, JSON.stringify(row!.blocks));
  }
  const source = JSON.parse(fs.readFileSync(HOME_SOURCE, 'utf8')) as Block[];
  const html = source.filter((b) => b.type === 'html');
  const ofClass = (cls: string) => {
    const found = html.find((b) => (b.html as string).includes(`class="${cls}"`) || new RegExp(`<section class="${cls}[" ]`).test(b.html as string));
    if (!found) throw new Error(`на главной нет блока ${cls}`);
    return found;
  };
  const byType = (type: string) => source.find((b) => b.type === type)!;

  const hk = await db.page.findUnique({ where: { path: '/' }, select: { cssTemplates: true } });
  await savePage({
    path: '/',
    template: 'home',
    title: page.title,
    description: page.description,
    preloadImage: await ensureAsset('/img/proizvodstvo-hero-v2-seo20261002.webp'),
    cssTemplates: hk?.cssTemplates ?? [],
    blocks: [
      ...styled(css),
      { type: 'html', html: hero },
      { type: 'html', html: greet },
      byType('catalogCards'),
      byType('leadgen'),
      byType('partner'),
      ofClass('foundry'),
      byType('stockShowcase'),
      careBlock(ofClass('care')),
      ofClass('upgrade'),
      worksBlock(ofClass('works'), cases),
      geomapBlock(ofClass('geomap')),
      byType('bestOffer'),
      { type: 'html', html: quotation },
      { type: 'script', code: MAP_LOADER },
    ],
  });
  console.log('главная собрана');
  return;
}

// ── Страницы живого сайта ───────────────────────────────────────────

const HUB_SCRIPT = (inline: string) => {
  const cases = inline.replace(/document\.addEventListener\('DOMContentLoaded', function\(\)\{/, 'function initCases(){').replace(/\n\s*\}\);\s*\n(\s*\/\/ — YouTube lite-iframe)/, '\n  }\n$1');
  if (!cases.includes('function initCases')) throw new Error('скрипт реестра проектов изменился');
  return `(function(){
  var lang = (location.pathname.match(/^\\/(kz|en)\\//) || [])[1];
  var s = document.createElement('script');
  s.src = '/js/cases-data' + (lang ? '-' + lang : '') + '.js?v=${DATA_VERSION}';
  s.onload = function(){ initCases(); };
  document.head.appendChild(s);
})();
${cases}
`;
};

async function buildOwnPages(home: Block[]): Promise<void> {
  const geomap = home.find((b) => b.type === 'html' && (b.html as string).includes('class="geomap"'))!;

  // контакты и о компании — как на живом сайте
  for (const [p, template] of [['/kontakty/', 'contacts'], ['/o-company/', 'company']] as const) {
    const page = livePage(p);
    const { blocks, html } = await liveBlocks(page);
    const css = await localizeAssets(extractCss(await page.css(), html));
    await savePage({ path: p, template, title: page.title, description: page.description, blocks: [...styled(css), ...blocks] });
    console.log(`${p}: блоков ${blocks.length}, стилей ${css.length}`);
  }

  // юридические страницы — реквизиты и законы Казахстана
  for (const p of ['/policy/', '/soglasie/']) {
    const page = livePage(p);
    const { blocks } = await liveBlocks(page);
    await savePage({ path: p, template: 'legal', title: page.title, description: page.description, noindex: true, cssTemplates: ['/css/tpl/legal.css'], blocks });
    console.log(`${p}: блоков ${blocks.length}`);
  }

  // реестр проектов: карта — тот же блок, что на главной; поиском не индексируется, как на живом сайте
  {
    const page = livePage('/proekty/');
    const { blocks, html } = await liveBlocks(page, { swap: { 'projects-map-section': geomap } });
    const css = await localizeAssets(extractCss(await page.css(), html));
    const inline = findAll(page.main, (el) => el.tagName === 'script' && !attr(el, 'src') && !attr(el, 'type')).map(textOf).find((s) => s.includes('casesByCategory'));
    if (!inline) throw new Error('нет скрипта реестра проектов');
    await savePage({
      path: '/proekty/',
      template: 'projects-root',
      title: page.title,
      description: page.description,
      noindex: true,
      blocks: [...styled(css), ...blocks, { type: 'script', code: HUB_SCRIPT(inline) }, { type: 'script', code: MAP_LOADER }],
    });
    console.log(`/proekty/: блоков ${blocks.length}, стилей ${css.length}`);
  }

  // страницы кейсов
  const INDEXED = new Set([PAVLODAR, `/proekty/${RYBINSK}/`]);
  const dir = path.join(LIVE, 'pages/ru/proekty');
  const slugs = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  let done = 0;
  for (const slug of slugs) {
    const p = `/proekty/${slug}/`;
    const page = livePage(p);
    const { blocks } = await liveBlocks(page);
    await savePage({ path: p, template: 'project', title: page.title, description: page.description, noindex: !INDEXED.has(p), cssTemplates: ['/css/tpl/proekt.css'], blocks });
    if (++done % 25 === 0) console.log(`кейсов: ${done} из ${slugs.length}`);
  }
  console.log(`кейсов: ${done}`);
}

// ── Настройки ───────────────────────────────────────────────────────

function textRules<T>(value: T): T {
  if (typeof value === 'string') return applyLinks(applyRules(value)) as T;
  if (Array.isArray(value)) return value.map(textRules) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === 'icon' ? v : textRules(v)])) as T;
  return value;
}

interface FooterColumn {
  links: { href: string }[];
}

async function buildSettings(): Promise<void> {
  const current = await api<Record<string, any>>('GET', '/admin/v1/settings'); // eslint-disable-line @typescript-eslint/no-explicit-any
  const next = textRules(current);
  next.contacts = {
    phones: [{ href: 'tel:+77758534095', text: '+7 (775) 853-40-95', label: 'Позвонить', local: false }],
    email: 'stasgross.ru@gmail.com',
    instagram: 'https://www.instagram.com/reel/DNF-x6zsaDt/?igsh=MWJsZjZmbmM5ZzRhOA==',
    tiktok: 'https://www.tiktok.com/@stas_gross?_r=1&_t=ZS-98IOPsrMYDw',
  };
  next.company = {
    tagline: 'Производство и поставка оборудования для металлургии и литейных производств с 2014 года.',
    copyright: '© 2026 ТОО «Gross Metal Engineering»',
    legal: 'Бенефициар: ТОО «Gross Metal Engineering» · БИН/ИИН 260440027830',
  };
  next.nav = (next.nav as { key: string }[]).filter((n) => n.key !== 'praktikum');
  next.drawer = (next.drawer as { href?: string }[]).filter((n) => n.href !== '/praktikum/');
  if (next.footer?.columns) {
    for (const col of next.footer.columns as FooterColumn[]) col.links = col.links.filter((l) => !l.href.startsWith('/praktikum'));
  }
  await api('PUT', '/admin/v1/settings', next);
  console.log('настройки сохранены');
}

// ── Страницы основного сайта, которых здесь нет ─────────────────────

/** Адреса со старых страниц: ближайшая существующая страница выше по адресу. */
function nearestPage(p: string, paths: Set<string>): string {
  let at = p;
  while (at !== '/') {
    if (paths.has(at)) return at;
    at = at.replace(/[^/]+\/$/, '');
  }
  return '/';
}

/** Страницы городов основного сайта (реестр /proekty/ там другой): их здесь нет. */
const MAIN_CITY = /^\/proekty\/(?:ufa|lipetsk|magnitogorsk|chelyabinsk|ekaterinburg|chermoz|miass|perm|kurgan)\/$/;

async function cleanup(): Promise<void> {
  // Практикума здесь нет; реестр проектов и кейсы — свои (страницы городов основного сайта убираем)
  const docs = await db.page.deleteMany({ where: { kind: 'document' } });
  const liveCases = new Set(fs.readdirSync(path.join(LIVE, 'pages/ru/proekty')));
  const projectPages = await db.page.findMany({ where: { path: { startsWith: '/proekty/' } }, select: { id: true, path: true } });
  const mainCities = projectPages.filter((p) => p.path !== '/proekty/' && !liveCases.has(p.path.split('/')[2]!));
  await db.page.deleteMany({ where: { id: { in: mainCities.map((p) => p.id) } } });
  const stock = await db.stockItem.deleteMany({});
  console.log(`удалено: документов ${docs.count}, страниц городов ${mainCities.length}, позиций склада ${stock.count}`);

  // страница «Спасибо»: блок кейсов основного сайта ведёт на убранные страницы
  const thanks = await db.page.findUnique({ where: { path: '/spasibo/' }, select: { id: true, blocks: true } });
  if (thanks) {
    const blocks = (thanks.blocks as Block[]).filter((b) => !(b.type === 'html' && /<section[^>]*class="cases/.test(b.html as string)) && b.type !== 'script');
    await db.page.update({ where: { id: thanks.id }, data: { blocks: blocks as object } });
  }

  // в описаниях товаров: ссылки на Практикум — убрать, на страницы городов основного сайта — на кейс или реестр
  const cities = new Set(mainCities.map((p) => p.path));
  const pages = await db.page.findMany({ where: { kind: 'page' }, select: { id: true, path: true, blocks: true } });
  for (const page of pages) {
    const raw = JSON.stringify(page.blocks);
    let next = raw.replace(/<p>(?:(?!<\/p>).)*?\/praktikum\/(?:(?!<\/p>).)*?<\/p>/g, '');
    if (next.includes('/praktikum')) throw new Error(`ссылка на Практикум осталась: страница ${page.path}`);
    next = next
      // адреса страниц, не файлов: фото этих кейсов лежат в /img/proekty/pavlodar/
      .replace(/\/(img|files)\/proekty\/postavka-ui-1t-800kw-uig-80t-pavlodar\//g, '/$1/proekty/pavlodar/')
      .replace(/\/(img|files)\/proekty\/postavka-drobemetnoy-ustanovki-uid-3210-rybinsk\//g, '/$1/proekty/rybinsk/')
      .replace(/(?<!\/(?:img|files))\/proekty\/pavlodar\//g, PAVLODAR)
      .replace(/(?<!\/(?:img|files))\/proekty\/rybinsk\//g, `/proekty/${RYBINSK}/`)
      // заголовок «Наличия»: одним куском, иначе в переводе «на складе» повторяется
      .replace('<em>в&nbsp;наличии</em> на&nbsp;складе', '<em>в&nbsp;наличии на&nbsp;складе</em>')
      .replace('<em>в наличии</em> на складе', '<em>в наличии на складе</em>')
      .replace(/\/proekty\/[a-z-]+\/(?=\\?")/g, (href) => (cities.has(href) || MAIN_CITY.test(href) ? '/proekty/' : href));
    if (next !== raw) await db.page.update({ where: { id: page.id }, data: { blocks: JSON.parse(next) as object } });
  }

  // адреса: со страниц живого сайта, которых нет здесь, и старые перенаправления — на существующие страницы
  const paths = new Set((await db.page.findMany({ where: { status: 'published' }, select: { path: true } })).map((p) => p.path));
  // страницы, которые на основном сайте убраны в перенаправления (кейсы живого .kz), здесь есть
  const shadowing = await db.redirect.deleteMany({ where: { fromPath: { in: [...paths] } } });
  if (shadowing.count) console.log(`перенаправлений поверх страниц убрано: ${shadowing.count}`);
  const redirects = await db.redirect.findMany({ select: { id: true, fromPath: true, toPath: true } });
  const taken = new Set(redirects.map((r) => r.fromPath));
  let moved = 0;
  for (const r of redirects) {
    const target = r.toPath.split(/[?#]/)[0]!;
    if (!target.startsWith('/') || paths.has(target)) continue;
    const to = nearestPage(target, paths);
    if (to === r.fromPath) await db.redirect.delete({ where: { id: r.id } });
    else await db.redirect.update({ where: { id: r.id }, data: { toPath: to } });
    moved++;
  }
  const added: { fromPath: string; toPath: string; code: number; source: string; comment: string }[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name), `${prefix}${e.name}/`);
      else if (e.name === 'index.html.gz' && !paths.has(prefix) && !taken.has(prefix) && prefix !== '/spasibo/') {
        added.push({ fromPath: prefix, toPath: nearestPage(prefix, paths), code: 301, source: 'manual', comment: 'страница живого uralinduktor.kz, которой нет на платформе' });
      }
    }
  };
  walk(path.join(LIVE, 'pages/ru'), '/');
  if (added.length) await db.redirect.createMany({ data: added, skipDuplicates: true });
  console.log(`перенаправления: исправлено ${moved}, добавлено ${added.length}`);
  for (const a of added) console.log(`  ${a.fromPath} → ${a.toPath}`);
}

// ── Заголовки и описания: те, что на живом сайте ────────────────────

async function liveSeo(own: Set<string>): Promise<void> {
  const digits = (s: string) => s.match(/\d+/g) ?? [];
  const pages = await db.page.findMany({ where: { kind: 'page' }, select: { id: true, path: true, title: true, description: true } });
  let changed = 0;
  for (const page of pages) {
    if (own.has(page.path) || page.path.startsWith('/proekty/') || !fs.existsSync(livePageFile(page.path))) continue;
    const live = livePage(page.path);
    const known = new Set(digits(`${page.title} ${page.description ?? ''}`));
    const safe = (s: string) => digits(s).every((d) => known.has(d)) && !/продлени|24 месяц/.test(s);
    const title = live.title && safe(live.title) ? live.title : page.title;
    const description = live.description && safe(live.description) ? live.description : page.description;
    if (title === page.title && description === page.description) continue;
    await db.page.update({ where: { id: page.id }, data: { title, description } });
    changed++;
  }
  console.log(`заголовков и описаний с живого сайта: ${changed}`);
}

// ── Запуск ──────────────────────────────────────────────────────────

const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const step = (name: string) => !only || only.includes(name);
if (step('settings')) await buildSettings();
if (step('home')) await buildHome(await buildScriptData());
if (step('own')) await buildOwnPages((await db.page.findUnique({ where: { path: '/' }, select: { blocks: true } }))!.blocks as Block[]);
if (step('cleanup')) await cleanup();
if (step('seo')) await liveSeo(new Set(['/', '/kontakty/', '/o-company/', '/policy/', '/soglasie/']));
await api('POST', '/admin/v1/cache/purge', {});
console.log('кеш контент-сервиса сброшен');
await close();
