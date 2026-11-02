import fs from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

// Локально переменные лежат в platform/.env (общий файл монорепо).
try {
  process.loadEnvFile(path.resolve(process.cwd(), '../../.env'));
} catch {
  /* в контейнере .env нет — переменные приходят из окружения */
}

const CONTENT = process.env.CONTENT_URL ?? 'http://127.0.0.1:4101';
const MEDIA = process.env.MEDIA_URL ?? 'http://127.0.0.1:4104';
const LEADS = process.env.LEADS_URL ?? 'http://127.0.0.1:4102';
const SEARCH = process.env.SEARCH_URL ?? 'http://127.0.0.1:4103';
const MAILING = process.env.MAILING_URL ?? 'http://127.0.0.1:4105';
const ADMIN = process.env.ADMIN_URL ?? 'http://127.0.0.1:3300';

const cache = (value: string) => [{ key: 'Cache-Control', value }];

/**
 * Версии файлов с постоянными адресами (ключи «v:путь») и версия сборки — из манифеста, который
 * пишет scripts/build-client.ts перед next build. Вшиваются в код сайта (src/lib/versions.ts).
 */
function staticVersions(): string {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/assets/manifest.json'), 'utf8')) as Record<string, string>;
    return JSON.stringify(Object.fromEntries(Object.entries(manifest).filter(([key]) => key.startsWith('v:') || key === 'build')));
  } catch {
    return '{}'; // сборки статики ещё не было — адреса без версий
  }
}

const nextConfig: NextConfig = {
  output: 'standalone',
  env: { MTPK_STATIC_VERSIONS: staticVersions() },
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  transpilePackages: ['@mtpk/content-kit', '@mtpk/content-model', '@mtpk/shared', '@mtpk/ui'],
  poweredByHeader: false,
  // индикатор Next.js Dev Tools в углу экрана — мешает попиксельной сверке со старым сайтом
  devIndicators: false,
  reactStrictMode: true,
  // Адреса сайта — со слешем на конце (так они в поиске). Редирект /foo → /foo/
  // делает src/proxy.ts кодом 301, как nginx (у Next по умолчанию 308).
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  // Картинки отдаёт медиасервис из S3; оптимизатор Next не нужен и не пишет кеш на диск.
  images: { unoptimized: true },
  experimental: {
    // Диск C у разработчика один: файловый кеш Turbopack (по умолчанию включён
    // и разрастается до гигабайт) отключаем и в dev, и в сборке.
    turbopackFileSystemCacheForDev: false,
    turbopackFileSystemCacheForBuild: false,
    // Заявка с вложением до 10 МБ проходит через прокси Next в dev
    proxyClientMaxBodySize: '20mb',
  },
  async rewrites() {
    return {
      // До файловой маршрутизации: иначе catch-all страница перехватит эти адреса.
      beforeFiles: [
        { source: '/img/:path*', destination: `${MEDIA}/img/:path*` },
        { source: '/files/:path*', destination: `${MEDIA}/files/:path*` },
        { source: '/docs/:path*', destination: `${MEDIA}/docs/:path*` },
        { source: '/og/:path*', destination: `${MEDIA}/og/:path*` },
        // ассеты Практикума — из медиасервиса, сами статьи (HTML-документы) — API-маршрут
        { source: '/praktikum/:path(.+\\.(?:css|js|webp|png|jpe?g|svg|gif|avif|woff2?|pdf))', destination: `${MEDIA}/praktikum/:path` },
        { source: '/praktikum', destination: '/api/praktikum' },
        { source: '/praktikum/:path*', destination: '/api/praktikum/:path*' },
        { source: '/sitemap-index.xml', destination: '/api/sitemap?part=index' },
        { source: '/sitemap-0.xml', destination: '/api/sitemap' },
        { source: '/css/inline-extracted/:file', destination: `${CONTENT}/v1/styles/:file` },
        // скрипты блоков «Скрипт» (собирает контент-сервис из TypeScript/JavaScript)
        { source: '/js/page/:file', destination: `${CONTENT}/v1/scripts/:file` },
        { source: '/data/:file(stock\\.json|compare-index\\.json|compare-sections\\.json|ui-strings\\.json)', destination: `${CONTENT}/v1/data/:file` },
        { source: '/api/send.php', destination: `${LEADS}/api/send.php` },
        { source: '/api/leads', destination: `${LEADS}/api/leads` },
        { source: '/api/search', destination: `${SEARCH}/api/search` },
        // ссылки из писем рассылок: переходы, открытия, отписка (сервис рассылок)
        { source: '/r/:path*', destination: `${MAILING}/r/:path*` },
        // админка на домене сайта: /admin (вход — по секретной ссылке, см. apps/admin/src/lib/gate.ts);
        // в проде этот адрес шлюз отдаёт админке сам, сюда запросы не доходят
        { source: '/admin', destination: `${ADMIN}/admin` },
        { source: '/admin/:path*', destination: `${ADMIN}/admin/:path*` },
      ],
    };
  },
  async headers() {
    // Кеш статики — как в nginx старого сайта: css/js 7 дней, шрифты и логотипы 30 дней.
    // Сброс — версией в адресе (?v=хеш содержимого, src/lib/versions.ts): её ставит сборка.
    return [
      // страницы (HTML) браузер сверяет с сервером при каждом заходе (ETag → 304, без загрузки), как статьи
      // Практикума: заголовок ISR (s-maxage, stale-while-revalidate) — для общих кешей, по нему браузер
      // мог бы показать сохранённую копию страницы после её обновления
      { source: '/:path*', has: [{ type: 'header', key: 'accept', value: '.*text/html.*' }], headers: cache('no-cache, must-revalidate') },
      { source: '/css/:path*', headers: cache('public, max-age=604800') },
      // клиентские модули: имя файла содержит хеш содержимого — кеш навсегда
      { source: '/assets/:path*', headers: cache('public, max-age=31536000, immutable') },
      { source: '/js/:path*', headers: cache('public, max-age=604800') },
      // карта проектов на главной: скрипт и точки подгружает блок «Скрипт» страницы — адрес без версии сборки
      // (у точек версии нет вовсе), поэтому браузер сверяет их с сервером не реже раза в 5 минут (ETag → 304):
      // новые проекты и правки карты доходят сразу, а не через неделю
      { source: '/js/:file(projects-map\\.js|projects-data\\.js)', headers: cache('public, max-age=300, must-revalidate') },
      // шрифты разрешены и другим источникам: их подгружает предпросмотр в админке
      { source: '/fonts/:path*', headers: [...cache('public, max-age=2592000'), { key: 'Access-Control-Allow-Origin', value: '*' }] },
      { source: '/brand/:path*', headers: cache('public, max-age=2592000') },
      // значок сайта и манифест (scripts/brand-icons.ts): без кеша браузер перепроверял их на каждом заходе
      { source: '/:file(favicon\\.ico|favicon\\.svg|apple-touch-icon\\.png|icon-192\\.png|icon-512\\.png|site\\.webmanifest)', headers: cache('public, max-age=604800') },
    ];
  },
};

export default nextConfig;
