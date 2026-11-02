/**
 * Сборка статики сайта (имена с хешем — кешируются навсегда):
 *  - клиентские модули (src/client/*.ts) → public/assets: минифицированные
 *    ES-модули, общий код — в отдельных чанках;
 *  - общие стили → public/assets: два файла по месту в каскаде — core.css
 *    (до стилей страницы) и core-end.css (после них). В коде страниц <style> нет;
 *  - шаблонные стили страниц (public/css/tpl) → public/assets/tpl с хешем.
 *    Цвета в CSS — с переменными тёмной темы (content-kit/src/dark.ts):
 *    светлая тема та же, у тёмной (html[data-theme=dark]) — свои значения;
 *  - старые скрипты страниц (src/legacy/*.ts) → public/js/<имя>.js: обычные
 *    скрипты (не модули), адреса прежние — на них ссылаются страницы;
 *  - логотипы (public/brand/*.png, *.jpg) → WebP-копии рядом (logo.png.webp):
 *    их берёт <picture> компонента Logo; новые и изменённые — при каждой сборке.
 * manifest.json «имя → файл» читает сервер (src/lib/assets.ts).
 * Картинки медиатеки (/img/…) — забота медиасервиса: WebP-копии и уменьшенные копии он делает сам.
 *
 *   tsx scripts/build-client.ts           — сборка (перед next build)
 *   tsx scripts/build-client.ts --watch   — разработка
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, context, transform, type BuildOptions, type Plugin } from 'esbuild';
import sharp from 'sharp';
import { darkVars } from '@mtpk/content-kit/dark';
import { responsiveHeroCss } from '@mtpk/content-kit/hero-css';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/assets');
const watch = process.argv.includes('--watch');
const TARGET = ['es2020', 'chrome90', 'safari15', 'firefox90'];

/** Модули: общий (на каждой странице) и модули отдельных блоков. */
const ENTRIES: Record<string, string> = {
  site: 'src/client/site.ts',
  gallery: 'src/client/gallery.ts',
  lightbox: 'src/client/lightbox.ts',
  'spec-nav': 'src/client/spec-nav.ts',
  'catalog-filter': 'src/client/catalog-filter.ts',
  carousel: 'src/client/carousel.ts',
  stock: 'src/client/stock.ts',
  // запчасти: окно «Запросить цену / подбор», фото на весь экран, количество
  spare: 'src/client/spare.ts',
  // панель администратора на страницах-документах (Практикум) — без общего модуля site
  'doc-bar': 'src/client/doc-bar.ts',
  // эффект праздничной обложки главной (снег, искры…) — только в дни праздника
  'holiday-fx': 'src/client/holiday-fx.ts',
  // карта без рекламы (Leaflet, OpenStreetMap): страницы с блоком data-free-map
  'free-map': 'src/client/free-map.ts',
};

/**
 * Общие стили в порядке каскада. Между core и core-end страница подключает
 * свои: шаблонные (/css/tpl) и собственные (/css/inline-extracted).
 */
const CSS_BUNDLES: Record<string, string[]> = {
  core: [
    'public/fonts/fonts-critical.css',
    'public/fonts/fonts-extended.css',
    'public/tokens.css',
    'public/css/site.css',
    'public/css/praktikum-nav-v26.css',
    'public/css/audit-fixes-20261002.css',
  ],
  'core-end': [
    'public/css/mobile-fixes.css',
    'public/css/stock.css',
    'public/css/base-layout.css',
    'src/styles/components.css',
    // разделы страниц — один вид на всех страницах (после шаблонов и стилей страниц)
    'src/styles/sections.css',
    // праздничная обложка главной (раздел «Праздники»)
    'src/styles/holiday.css',
    'src/styles/widgets.css',
    // окно поиска по «лупе» (client/search.ts)
    'src/styles/search.css',
    'src/styles/theme-dark.css',
  ],
};
/** Правила самой тёмной темы — как есть: цвета в них уже тёмные, переменные --dk-… им не нужны. */
const AS_IS = new Set(['src/styles/theme-dark.css']);
/** Шаблонные стили страниц (на них ссылаются страницы: page.cssTemplates). */
const TPL_DIR = 'public/css/tpl';

/** Старые скрипты страниц: каждый — отдельный файл public/js/<имя>.js. */
const LEGACY_DIR = 'src/legacy';
const legacyEntries = () =>
  fs
    .readdirSync(path.join(ROOT, LEGACY_DIR))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .map((f) => `${LEGACY_DIR}/${f}`);

const hash = (s: string) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);

async function writeCss(name: string, source: string): Promise<string> {
  const { code } = await transform(source, { loader: 'css', minify: !watch, legalComments: 'none' });
  const file = `${name}-${hash(code)}.css`;
  fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true });
  fs.writeFileSync(path.join(OUT, file), code);
  return `/assets/${file}`;
}

async function buildCss(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const [name, files] of Object.entries(CSS_BUNDLES)) {
    const own = files.filter((f) => !AS_IS.has(f)).map(read).join('\n');
    const asIs = files.filter((f) => AS_IS.has(f)).map(read).join('\n');
    // фото обложки главной (.hero__image) — телефонам копией 828 px (hero-css.ts)
    out[`${name}.css`] = await writeCss(name, responsiveHeroCss(`${darkVars(own)}\n${asIs}`));
  }
  for (const f of fs.readdirSync(path.join(ROOT, TPL_DIR)).filter((x) => x.endsWith('.css'))) {
    // шаблоны задают цвета и своими переменными (--ink: #142a32) — им тоже тёмные значения
    out[`tpl/${f}`] = await writeCss(`tpl/${f.slice(0, -4)}`, responsiveHeroCss(darkVars(read(`${TPL_DIR}/${f}`), { ownVars: true })));
  }
  return out;
}

const contentHash = (file: string) => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 10);

/**
 * Версии файлов с постоянными адресами, на которые ссылаются страницы: старые скрипты (public/js),
 * логотипы (public/brand), значки сайта; ключ «v:путь» → хеш содержимого. Страница ставит адрес
 * с ?v=хеш (src/lib/versions.ts; в код их вшивает next.config.ts): поменялся файл — поменялся адрес,
 * браузер и шлюз берут новый без чистки кеша. tpl-css-version — одна версия шаблонов /css/tpl
 * (их адреса берёт предпросмотр в админке).
 */
function staticVersions(): Record<string, string> {
  const out: Record<string, string> = {};
  const add = (rel: string) => {
    const file = path.join(ROOT, 'public', rel);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) out[`v:${rel}`] = contentHash(file);
  };
  for (const f of fs.readdirSync(path.join(ROOT, 'public/js')).filter((x) => x.endsWith('.js'))) add(`js/${f}`);
  for (const f of fs.readdirSync(path.join(ROOT, 'public/brand'))) add(`brand/${f}`);
  for (const f of ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'site.webmanifest']) add(f);
  const tpl = fs
    .readdirSync(path.join(ROOT, TPL_DIR))
    .filter((x) => x.endsWith('.css'))
    .sort()
    .map((f) => fs.readFileSync(path.join(ROOT, TPL_DIR, f), 'utf8'))
    .join('\n');
  out['tpl-css-version'] = hash(tpl);
  return out;
}

const writeManifest: Plugin = {
  name: 'manifest',
  setup(b) {
    b.onStart(() => {
      fs.rmSync(OUT, { recursive: true, force: true });
    });
    b.onEnd(async (result) => {
      if (result.errors.length || !result.metafile) return;
      fs.mkdirSync(OUT, { recursive: true });
      const manifest: Record<string, string> = {};
      let bytes = 0;
      for (const [file, meta] of Object.entries(result.metafile.outputs)) {
        bytes += meta.bytes;
        if (!meta.entryPoint) continue;
        const name = Object.entries(ENTRIES).find(([, src]) => path.resolve(ROOT, src) === path.resolve(ROOT, meta.entryPoint!))?.[0];
        if (name) manifest[name] = `/${path.relative(path.join(ROOT, 'public'), path.resolve(ROOT, file)).split(path.sep).join('/')}`;
      }
      Object.assign(manifest, await buildCss(), staticVersions());
      manifest.build = hash(JSON.stringify(manifest));
      fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
      console.log(`статика сайта: модулей ${Object.keys(ENTRIES).length}, JS ${(bytes / 1024).toFixed(1)} КБ, стили ${Object.keys(CSS_BUNDLES).length} файла`);
    });
  },
};

const modules: BuildOptions = {
  absWorkingDir: ROOT,
  entryPoints: ENTRIES,
  outdir: OUT,
  entryNames: '[name]-[hash]',
  chunkNames: 'chunks/[name]-[hash]',
  bundle: true,
  splitting: true,
  // стили библиотеки карты — текстом: модуль вставляет их сам, только на странице с картой
  loader: { '.css': 'text' },
  format: 'esm',
  platform: 'browser',
  target: TARGET,
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  legalComments: 'none',
  metafile: true,
  logLevel: 'warning',
  plugins: [writeManifest],
};

/** Обычные скрипты: каждый в своей области видимости (IIFE), типы стираются. */
const legacy: BuildOptions = {
  absWorkingDir: ROOT,
  entryPoints: legacyEntries(),
  outdir: 'public/js',
  bundle: false,
  format: 'iife',
  platform: 'browser',
  target: TARGET,
  minify: !watch,
  // кириллица как есть (как в прежних файлах), а не \uXXXX — файлы заметно меньше
  charset: 'utf8',
  legalComments: 'none',
  logLevel: 'warning',
  plugins: [
    {
      name: 'legacy-report',
      setup(b) {
        b.onEnd((result) => {
          if (!result.errors.length) console.log(`старые скрипты страниц: ${legacyEntries().length} файлов → public/js`);
        });
      },
    },
  ],
};

/**
 * WebP-копии логотипов: нет копии или исходник новее — создать. Копия есть у
 * каждого PNG/JPG: компонент Logo всегда ставит её источником <picture>.
 */
async function brandWebp(): Promise<void> {
  const dir = path.join(ROOT, 'public/brand');
  let made = 0;
  for (const name of fs.readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f))) {
    const src = path.join(dir, name);
    const copy = `${src}.webp`;
    if (fs.existsSync(copy) && fs.statSync(copy).mtimeMs >= fs.statSync(src).mtimeMs) continue;
    fs.writeFileSync(copy, await sharp(fs.readFileSync(src)).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toBuffer());
    made++;
  }
  if (made) console.log(`логотипы: WebP-копий создано ${made} (public/brand)`);
}

await brandWebp();

if (watch) {
  await Promise.all([(await context(modules)).watch(), (await context(legacy)).watch()]);
  // стили пересобираются вместе с модулями; правка только CSS — перезапуск сборщика
  console.log('статика сайта: слежу за изменениями…');
} else {
  // сначала старые скрипты: манифест модулей записывает и их версии (staticVersions)
  await build(legacy);
  await build(modules);
}
