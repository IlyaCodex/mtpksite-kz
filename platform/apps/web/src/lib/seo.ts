import type { Metadata } from 'next';
import type { PageDto } from '@mtpk/shared/contracts';
import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, SITE } from './site';

/** JSON-LD Organization — единое описание компании (SEO-T3). */
export const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE}/#organization`,
  name: 'УралИндуктор',
  legalName: 'ТОО «Gross Metal Engineering»',
  alternateName: 'Gross Metal Engineering',
  url: SITE,
  logo: {
    '@type': 'ImageObject',
    '@id': `${SITE}/brand/logo-color.png`,
    url: `${SITE}/brand/logo-color.png`,
    width: 1898,
    height: 495,
  },
  image: `${SITE}/og/default.jpg`,
  description:
    'Производство индукционных плавильных печей, дробемётных установок, чиллеров и градирен, сталеразливочных ковшей и оборудования для литейных производств.',
  telephone: '+7-775-853-40-95',
  email: 'stasgross.ru@gmail.com',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'район Сарыарка, отель Radisson, офис 4',
    addressLocality: 'Астана',
    addressRegion: 'Астана',
    postalCode: '010000',
    addressCountry: 'KZ',
  },
  areaServed: ['Казахстан', 'Узбекистан', 'Кыргызстан', 'Таджикистан', 'Армения', 'Беларусь'].map((name) => ({
    '@type': 'Country',
    name,
  })),
  sameAs: ['https://t.me/uralinduktor', 'https://wa.me/77758534095', 'https://www.tiktok.com/@stas_gross'],
};

/** JSON-LD WebSite с поиском по сайту — только на главной. */
export const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE}/#website`,
  url: `${SITE}/`,
  name: 'УралИндуктор',
  description:
    'Производство индукционных плавильных печей, дробемётных установок, чиллеров и градирен, сталеразливочных ковшей и оборудования для литейных производств.',
  publisher: { '@id': `${SITE}/#organization` },
  inLanguage: 'ru-RU',
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE}/?q={search_term_string}` },
    'query-input': { '@type': 'PropertyValueSpecification', valueRequired: true, valueName: 'search_term_string' },
  },
};

/** JSON для <script type="application/ld+json">: «</» экранируется, чтобы не закрыть тег. */
export function jsonLdHtml(json: string | object): string {
  const s = typeof json === 'string' ? json : JSON.stringify(json);
  return s.replace(/<\//g, '<\\/');
}

/**
 * Картинка превью ссылки (og:image — мессенджеры, соцсети): фото товара или статьи из разметки
 * страницы, иначе фото обложки (hero). null — общая картинка сайта (og/default.jpg).
 */
export function pageOgImage(jsonLd: (string | object)[], hero: string | null): string | null {
  // разметка страницы приходит строками JSON (как пишется в <script>)
  const parse = (d: string | object): unknown => {
    if (typeof d !== 'string') return d;
    try {
      return JSON.parse(d);
    } catch {
      return null;
    }
  };
  const items = jsonLd
    .map(parse)
    .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
    .flatMap((d) => (d['@graph'] as Record<string, unknown>[] | undefined) ?? [d]);
  for (const item of items) {
    const types = ([] as string[]).concat((item['@type'] as string | string[] | undefined) ?? []);
    if (!types.some((t) => t === 'Product' || t.endsWith('Article'))) continue;
    const first = ([] as unknown[]).concat(item.image ?? [])[0];
    const url = typeof first === 'string' ? first : (first as { url?: string } | undefined)?.url;
    if (url && !url.endsWith(DEFAULT_OG_IMAGE)) return url;
  }
  return hero ? `${SITE}${hero}` : null;
}

const VERIFICATION: Metadata['verification'] = {
  // Google Search Console (2026-08-28) и Яндекс.Вебмастер — тот же код, что в /yandex_*.html
  google: 'klj1lj9utoieH9ZljmhDYykW6XSM3G7dtdVklWGJQw4',
  yandex: '5cf3197708e8d0e7',
};

const ICONS: Metadata['icons'] = {
  icon: [
    { url: '/favicon.ico', sizes: '32x32' },
    { url: '/favicon.svg', type: 'image/svg+xml' },
  ],
  apple: '/apple-touch-icon.png',
};

/** Метаданные страницы: title, description, canonical, robots, Open Graph, Twitter (SEO-T1/T2). */
export function pageMetadata(page: Pick<PageDto, 'path' | 'title' | 'description' | 'noindex'>): Metadata {
  const canonical = `${SITE}${page.path}`;
  const description = page.description ?? undefined;
  const ogDescription = page.description ?? DEFAULT_DESCRIPTION;
  const image = `${SITE}${DEFAULT_OG_IMAGE}`;
  return {
    metadataBase: new URL(SITE),
    title: page.title,
    description,
    alternates: { canonical },
    robots: page.noindex ? { index: false, follow: true } : undefined,
    verification: VERIFICATION,
    icons: ICONS,
    openGraph: {
      type: 'website',
      url: canonical,
      title: page.title,
      description: ogDescription,
      images: [{ url: image, width: 1200, height: 630 }],
      siteName: 'УралИндуктор',
      locale: 'ru_RU',
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: ogDescription,
      images: [image],
    },
  };
}

export const NOT_FOUND_PAGE = {
  path: '/404/',
  title: 'Страница не найдена — УралИндуктор',
  description:
    'Запрошенная страница не найдена. Вернитесь на главную сайта УралИндуктор или воспользуйтесь поиском.',
  noindex: false,
};
