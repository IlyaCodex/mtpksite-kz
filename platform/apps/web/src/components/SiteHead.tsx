import { DEFAULT_LOCALE, LANG_CODE, LOCALES, OG_LOCALE, type Locale } from '@mtpk/content-kit/i18n';
import type { PageDto } from '@mtpk/shared/contracts';
import { HEADER_LOGO, logoPreload } from '@/components/layout/Logo';
import { clientModuleUrl, templateCssUrl } from '@/lib/assets';
import { jsonLdHtml, ORGANIZATION_SCHEMA } from '@/lib/seo';
import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, SITE } from '@/lib/site';
import { THEME_INIT } from '@/lib/theme';
import { versioned } from '@/lib/versions';

export type HeadPage = Pick<
  PageDto,
  'path' | 'title' | 'description' | 'noindex' | 'preloadImage' | 'jsonLd' | 'cssTemplates' | 'externalStyles' | 'inlineStyles'
> & {
  locale: Locale;
  /** srcset/sizes предзагружаемой картинки — те же, что у неё на странице */
  preloadSrcSet?: string | null;
  preloadSizes?: string | null;
  /** фото обложки (фон из CSS): узким экранам — копия 828 px, широким — исходник (hero-css.ts) */
  preloadHero?: { href: string; media: string }[] | null;
  /** картинка превью ссылки (seo.ts, pageOgImage); нет — общая картинка сайта 1200×630 */
  ogImage?: string | null;
  /** разметка компании и сайта на языке страницы; нет — разметка компании на русском */
  siteJsonLd?: object[];
};

/**
 * Общее для всех страниц сайта и статей Практикума (lib/site-chrome.tsx): значок компании,
 * предзагрузка логотипа шапки и шрифтов, модулей страницы и общие стили core.css.
 */
export function CoreAssets({ modules = [] }: { modules?: string[] }) {
  const core = clientModuleUrl('core.css');
  return (
    <>
      {/* значок компании (scripts/brand-icons.ts): SVG — новым браузерам и Яндексу, ICO — остальным
          и Google, PNG — iPhone и Android */}
      <link rel="icon" href={versioned('/favicon.ico')} sizes="32x32" />
      <link rel="icon" href={versioned('/favicon.svg')} type="image/svg+xml" />
      <link rel="apple-touch-icon" href={versioned('/apple-touch-icon.png')} />
      <link rel="manifest" href={versioned('/site.webmanifest')} />
      {/* Лого в шапке; Inter (вариативный: один файл на алфавит — все толщины) — параллельно с HTML (T-PERF-2) */}
      <link rel="preload" as="image" {...logoPreload(HEADER_LOGO)} fetchPriority="high" />
      <link rel="preload" href="/fonts/inter-cyrillic.woff2" as="font" type="font/woff2" crossOrigin="" />
      <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
      {/* модули страницы качаются параллельно со стилями, выполняются после разбора HTML */}
      {modules.map((src) => (
        <link key={src} rel="modulepreload" href={src} />
      ))}
      {core && <link rel="stylesheet" href={core} />}
    </>
  );
}

/**
 * <head> страницы. Все стили — внешние файлы (кешируются браузером, в коде
 * страницы <style> нет). Порядок — каскад прежнего сайта: общее ядро
 * (core.css) → шаблонные стили страницы → её собственные → мобильные правки
 * и компоненты (core-end.css).
 */
export function SiteHead({ page, home = false, modules = [] }: { page: HeadPage; home?: boolean; modules?: string[] }) {
  const canonical = `${SITE}/${page.locale}${page.path}`;
  const ogDescription = page.description ?? DEFAULT_DESCRIPTION;
  const image = page.ogImage ?? `${SITE}${DEFAULT_OG_IMAGE}`;
  const coreEnd = clientModuleUrl('core-end.css');
  return (
    <>
      {/* тёмная тема — до стилей, чтобы страница не мигнула светлой (lib/theme.ts) */}
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      <title>{page.title}</title>
      {page.description && <meta name="description" content={page.description} />}
      <link rel="canonical" href={canonical} />
      {LOCALES.map((l) => (
        <link key={l} rel="alternate" hrefLang={LANG_CODE[l]} href={`${SITE}/${l}${page.path}`} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={`${SITE}/${DEFAULT_LOCALE}${page.path}`} />
      {page.noindex && <meta name="robots" content="noindex, follow" />}
      {/* Google Search Console — подтверждение прежнего uralinduktor.kz */}
      <meta name="google-site-verification" content="o34IhcdZPf5o85DLm4M6MxOfw_Amv3V-3jHf8IpGk78" />
      <meta property="og:title" content={page.title} />
      <meta property="og:description" content={ogDescription} />
      <meta property="og:url" content={canonical} />
      <meta property="og:site_name" content={page.locale === 'en' ? 'UralInduktor' : 'УралИндуктор'} />
      <meta property="og:locale" content={OG_LOCALE[page.locale]} />
      <meta property="og:image" content={image} />
      {/* размеры известны только у общей картинки; у фото страницы их возьмёт сам мессенджер */}
      {!page.ogImage && <meta property="og:image:width" content="1200" />}
      {!page.ogImage && <meta property="og:image:height" content="630" />}
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={page.title} />
      <meta name="twitter:description" content={ogDescription} />
      <meta name="twitter:image" content={image} />

      {(page.siteJsonLd ?? [ORGANIZATION_SCHEMA]).map((json, i) => (
        <script key={`site-ld${i}`} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(json) }} />
      ))}
      <CoreAssets modules={modules} />
      {page.preloadImage && (
        <link
          rel="preload"
          as="image"
          href={page.preloadImage}
          imageSrcSet={page.preloadSrcSet ?? undefined}
          imageSizes={page.preloadSizes ?? undefined}
          fetchPriority="high"
        />
      )}
      {page.preloadHero?.map((p) => (
        <link key={p.media} rel="preload" as="image" href={p.href} media={p.media} fetchPriority="high" />
      ))}
      {page.jsonLd.map((json, i) => (
        <script key={`ld${i}`} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(json) }} />
      ))}
      {page.cssTemplates.map((href) => (
        <link key={href} rel="stylesheet" href={templateCssUrl(href)} />
      ))}
      {page.externalStyles.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
      {coreEnd && <link rel="stylesheet" href={coreEnd} />}
    </>
  );
}
