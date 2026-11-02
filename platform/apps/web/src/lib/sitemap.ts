import { compareWalkOrder } from '@mtpk/content-kit/compare';
import { DEFAULT_LOCALE, LANG_CODE, LOCALES } from '@mtpk/content-kit/i18n';
import { inSitemap, sitemapRules } from '@mtpk/content-kit/page-meta';
import { listPages } from './content';
import { SITE } from './site';

const URLSET_OPEN =
  '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Карта сайта: индекс sitemap-index.xml и один файл sitemap-0.xml, lastmod из истории
 * правок (SEO-T6), priority/changefreq по типу страницы, без служебных и noindex.
 * Каждая страница — на трёх языках, со ссылками на другие языки (hreflang).
 */
export async function buildSitemap(): Promise<string> {
  const pages = (await listPages())
    .filter((p) => p.kind === 'page' && !p.noindex && inSitemap(p.path))
    .sort((a, b) => compareWalkOrder(a.path, b.path));
  const urls = pages.flatMap((p) => {
    const { priority, changefreq } = sitemapRules(p.path);
    const links = LOCALES.map((l) => `<xhtml:link rel="alternate" hreflang="${LANG_CODE[l]}" href="${esc(`${SITE}/${l}${p.path}`)}"/>`).join('');
    const fallback = `<xhtml:link rel="alternate" hreflang="x-default" href="${esc(`${SITE}/${DEFAULT_LOCALE}${p.path}`)}"/>`;
    return LOCALES.map(
      (l) =>
        `<url><loc>${esc(`${SITE}/${l}${p.path}`)}</loc>${links}${fallback}<lastmod>${p.lastmodAt}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority.toFixed(1)}</priority></url>`,
    );
  });
  return `${URLSET_OPEN}${urls.join('')}</urlset>`;
}

export function buildSitemapIndex(lastmod: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${SITE}/sitemap-0.xml</loc><lastmod>${lastmod}</lastmod></sitemap></sitemapindex>`;
}
