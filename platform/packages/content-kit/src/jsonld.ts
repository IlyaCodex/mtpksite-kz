/**
 * JSON-LD разметка страниц (аудиты 01–02.10.2026: P0-2, R1, R5). Источник данных — видимый HTML
 * страницы, поэтому разметка не расходится с текстом.
 */
import { decodeEntities } from './html.ts';
import type { StockOffer } from './stock.ts';

export const DEFAULT_SITE = 'https://uralinduktor.kz';

// Крошки на сайте размечены несколькими способами — исторически, разными пакетами:
//   каталог    <nav class="breadcrumb">  …  <span class="breadcrumb__current">
//   запчасти   <div class="breadcrumbs"> …  последний <span> без класса
//   проекты    <div class="ui-crumb">    …  <span class="ui-crumb-current">
//   транзисторные запчасти <nav class="tr-crumbs">
//   электромагниты, доп оборудование <nav class="crumbs">, тигли <nav class="uc-breadcrumbs"> (пакеты 09.10.2026)
export function breadcrumbInner(html: string): string | null {
  for (const re of [
    /<nav\s+class="breadcrumb[^"]*"[^>]*>([\s\S]*?)<\/nav>/,
    /<div\s+class="breadcrumbs"[^>]*>([\s\S]*?)<\/div>/,
    /<div\s+class="ui-crumb"[^>]*>([\s\S]*?)<\/div>/,
    /<nav\s+class="tr-crumbs"[^>]*>([\s\S]*?)<\/nav>/,
    /<nav\s+class="(?:crumbs|uc-breadcrumbs)"[^>]*>([\s\S]*?)<\/nav>/,
  ]) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

export function buildBreadcrumbSchema(html: string, pageUrl: string, site = DEFAULT_SITE): string | null {
  const inner = breadcrumbInner(html);
  if (!inner) return null;
  const items: { name: string; url?: string }[] = [];
  const linkRe = /<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(inner)) !== null) {
    items.push({ url: m[1], name: decodeEntities(m[2]) });
  }
  // Последняя крошка: со своим классом либо, у запчастей, просто последний
  // <span> без класса (разделители «/» отбрасываем).
  let current: string | null = null;
  const classed = inner.match(/<span\s+class="(?:breadcrumb__current|ui-crumb-current)"[^>]*>([^<]+)<\/span>/);
  if (classed) {
    current = classed[1];
  } else {
    const plain = [...inner.matchAll(/<span(?:\s+aria-current="page")?>([^<]+)<\/span>/g)]
      .map((s) => s[1].trim())
      .filter((t) => t && t !== '/' && !/^\d+\s*\/\s*\d+$/.test(t));
    if (plain.length) current = plain[plain.length - 1];
  }
  if (current) {
    // У последней крошки тоже должен быть item: без него Я.Вебмастер считает
    // цепочку незамкнутой. URL — сама страница (canonical, с trailing slash).
    items.push({ name: decodeEntities(current), url: pageUrl });
  }
  if (items.length < 2) return null;
  const listItems = items.map((it, i) => {
    const item: Record<string, unknown> = { '@type': 'ListItem', position: i + 1, name: it.name };
    if (it.url) {
      let abs = it.url.startsWith('http') ? it.url : `${site}${it.url}`;
      if (!abs.endsWith('/')) abs += '/';
      item.item = abs;
    }
    return item;
  });
  return JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: listItems });
}

/**
 * Разделы верхнего уровня (/kontakty/, /otzyvy/, /proekty/) крошек в вёрстке
 * не имеют. Цепочку «Главная → страница» собираем из адреса и заголовка.
 */
export function fallbackBreadcrumb(slugPath: string, title: string, pageUrl: string, site = DEFAULT_SITE): string | null {
  if (!slugPath || slugPath.includes('/')) return null;
  const name = decodeEntities(title.split('|')[0].replace(/\s*—\s*УралИндуктор\s*$/i, '').trim());
  if (!name) return null;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: `${site}/` },
      { '@type': 'ListItem', position: 2, name, item: pageUrl },
    ],
  });
}

// Артикул = модель из заголовка: токен с буквами и цифрами через дефис
// (УИД-326, УИ-0.35Т-300, AC-014, CB-01) либо сплошной код (Y38KKE).
export function extractModel(name: string): string | null {
  const hyphen = name.match(/(?:^|[\s(«])([A-ZА-Я]{1,4}[-\u2011][\dА-ЯA-Z][A-Z0-9А-Я.,\u2011/-]*)/);
  if (hyphen) return hyphen[1].replace(/[.,]+$/, '');
  const solid = name.match(/(?:^|[\s(«])([A-Z]{1,3}\d{2,}[A-Z]*)(?:$|[\s,.)»])/);
  if (solid) return solid[1];
  const tail = name.trim().split(/\s+/).pop() || '';
  if (/^[A-Z0-9][A-Z0-9/.-]{3,}$/.test(tail) && /\d/.test(tail) && /[A-Z]/.test(tail)) return tail;
  const series = name.match(/(?:^|[\s(«])(УИ[А-ЯЁ]{1,3})(?:$|[\s,.)»])/);
  if (series) return series[1];
  return null;
}

/** Раздел каталога — цепочка крошек без «Главная», «Каталог» и самой страницы. */
export function extractCategory(html: string): string | null {
  const inner = breadcrumbInner(html);
  if (!inner) return null;
  const names: string[] = [];
  const re = /<a\s+href="[^"]+"[^>]*>([^<]+)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) names.push(decodeEntities(m[1]));
  const parts = names.filter((n) => !/^(Главная|Каталог оборудования|Каталог)$/i.test(n));
  return parts.length ? parts.join(' / ') : null;
}

const KEY_SPECS = /мощность|частота|загрузк|напряжен|производительн|ёмкост|емкост|масса|объём|объем|температур|сечение|расход/i;

/** Характеристики из таблиц .spec-table/.tr-specs: сначала ключевые, всего ≤ 6. */
export function extractProperties(html: string): Record<string, unknown>[] {
  const tables = html.match(/<table\s+class="spec-table"[^>]*>[\s\S]*?<\/table>/g);
  const rows: { name: string; value: string }[] = [];
  if (tables) {
    const re = /<tr>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g;
    let m: RegExpExecArray | null;
    const all = tables.join('');
    while ((m = re.exec(all)) !== null) {
      const name = decodeEntities(m[1].replace(/<[^>]+>/g, ''));
      const value = decodeEntities(m[2].replace(/<[^>]+>/g, ''));
      if (name && value && value !== '—' && !/^Обозначение в каталоге$/i.test(name)) rows.push({ name, value });
    }
  }
  if (tables) {
    for (const t of tables) {
      const head = t.match(/<thead>([\s\S]*?)<\/thead>/);
      if (!head) continue;
      const ths = head[1].match(/<th[^>]*>([\s\S]*?)<\/th>/g) || [];
      if (ths.length !== 2) continue;
      if (!/параметр|характеристик|показател/i.test(decodeEntities(ths[0].replace(/<[^>]+>/g, '')))) continue;
      const re = /<tr>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(t)) !== null) {
        const name = decodeEntities(m[1].replace(/<[^>]+>/g, ''));
        const value = decodeEntities(m[2].replace(/<[^>]+>/g, ''));
        if (name && value && value !== '—') rows.push({ name, value });
      }
    }
  }
  const trTables = html.match(/<table\s+class="tr-specs"[^>]*>[\s\S]*?<\/table>/g);
  if (trTables) {
    const re = /<tr>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/g;
    let m: RegExpExecArray | null;
    const all = trTables.join('');
    while ((m = re.exec(all)) !== null) {
      const name = decodeEntities(m[1].replace(/<[^>]+>/g, ''));
      const value = decodeEntities(m[2].replace(/<small[\s\S]*?<\/small>/g, '').replace(/<[^>]+>/g, ''));
      if (name && value && value !== '—') rows.push({ name, value });
    }
  }
  if (!rows.length) return [];
  const picked = [...rows.filter((r) => KEY_SPECS.test(r.name)), ...rows.filter((r) => !KEY_SPECS.test(r.name))].slice(0, 6);
  return picked.map((r) => {
    const split = r.value.match(/^([\d.,]+(?:\s*[–\-×/]\s*[\d.,]+)?)\s+([^\d\s]\S{0,11})$/);
    return split
      ? { '@type': 'PropertyValue', name: r.name, value: split[1], unitText: split[2] }
      : { '@type': 'PropertyValue', name: r.name, value: r.value };
  });
}

/**
 * Product — на товарных страницах (.phero, .product-overview, .tr-product-overview). Цена (offers) — только
 * когда товар есть в «Наличии на складе» с ценой и страница её показывает (карточка .phero): остальная цена
 * проектная, её в разметке нет.
 */
export function buildProductSchema(html: string, description: string | null, canonicalAbs: string, site = DEFAULT_SITE, offer?: StockOffer): string | null {
  const isHero = /<section\s+class="phero"/.test(html);
  const isSpare = /<div\s+class="product-overview"/.test(html);
  const isTr = /<div\s+class="tr-product-overview"/.test(html);
  if (!isHero && !isSpare && !isTr) return null;

  const nameMatch = html.match(/<h1\s+class="phero__title"[^>]*>([\s\S]+?)<\/h1>/)
    || ((isSpare || isTr) ? html.match(/<h1[^>]*>([\s\S]+?)<\/h1>/) : null);
  if (!nameMatch) return null;
  const name = nameMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

  const abs = (u: string) => (u.startsWith('http') ? u : `${site}${u.replace(/\?v=[\w.]+/, '')}`);
  const imgMatch = html.match(/class="phero__main"[\s\S]*?<img\b[^>]*?\bsrc="([^"]+)"/)
    || (isSpare ? html.match(/class="product-photo"[^>]*\bdata-zoom="([^"]+)"/) : null)
    || (isSpare ? html.match(/class="product-visual"[\s\S]*?<img\b[^>]*?\bsrc="([^"]+)"/) : null)
    || (isTr ? html.match(/class="tr-product-photo"[\s\S]*?\bdata-zoom="([^"]+)"/) : null);
  const gallery = (html.match(/data-full="([^"]+)"/g) || []).map((a) => abs(a.slice(11, -1)));
  const isCategoryShot = (u: string) => /\/(card-|category-)|-main-standard|pech-main-|uid-prokat-photo/.test(u);
  const images = [...new Set([...(imgMatch ? [abs(imgMatch[1])] : []), ...gallery])]
    .map((u, i) => ({ u, i }))
    .sort((a, b) => (isCategoryShot(a.u) ? 1 : 0) - (isCategoryShot(b.u) ? 1 : 0) || a.i - b.i)
    .map((x) => x.u)
    .slice(0, 8);

  // image — только фото самого товара: общую картинку сайта Google товаром не считает (поле необязательное)
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description: description ?? name,
    ...(images.length ? { image: images } : {}),
    brand: { '@type': 'Brand', name: 'УралИндуктор' },
    manufacturer: { '@id': `${site}/#organization` },
    url: canonicalAbs,
  };
  const catalogCode = html.match(/<th[^>]*>\s*Обозначение в каталоге\s*<\/th>\s*<td[^>]*>([^<]+)<\/td>/);
  const model = (catalogCode ? decodeEntities(catalogCode[1]) : null) || extractModel(name);
  if (model) {
    schema.sku = model;
    schema.mpn = model;
  }
  const category = extractCategory(html);
  if (category) schema.category = category;
  const props = extractProperties(html);
  if (props.length) schema.additionalProperty = props;
  if (offer && isHero) {
    // позиции со склада: наименьшая (и наибольшая) цена, их число; товар в наличии
    schema.offers = {
      '@type': 'AggregateOffer',
      lowPrice: String(offer.price),
      ...(offer.maxPrice ? { highPrice: String(offer.maxPrice) } : {}),
      priceCurrency: 'RUB',
      offerCount: String(offer.offers),
      availability: 'https://schema.org/InStock',
    };
  }
  return JSON.stringify(schema);
}

/** Article — на кейсах /proekty/<город>/. Даты — из истории правок исходника. */
export function buildArticleSchema(
  html: string,
  description: string | null,
  canonicalAbs: string,
  dates: { published?: string | null; modified?: string | null },
  site = DEFAULT_SITE,
): string | null {
  if (!/<div\s+class="ui-case"/.test(html)) return null;
  const h1 = html.match(/<h1[^>]*>([\s\S]+?)<\/h1>/);
  if (!h1) return null;
  const headline = decodeEntities(h1[1].replace(/<[^>]+>/g, ''));
  const img = html.match(/class="ui-main-photo"[\s\S]*?<img\b[^>]*?\bsrc="([^"]+)"/)
    || html.match(/class="ui-main-photo"[\s\S]*?\bdata-full="([^"]+)"/);
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description: description ?? headline,
    url: canonicalAbs,
    mainEntityOfPage: canonicalAbs,
    author: { '@id': `${site}/#organization` },
    publisher: { '@id': `${site}/#organization` },
  };
  if (img) {
    const u = img[1];
    schema.image = [u.startsWith('http') ? u : `${site}${u.replace(/\?v=[\w.]+/, '')}`];
  }
  if (dates.published) schema.datePublished = dates.published;
  if (dates.modified) schema.dateModified = dates.modified;
  return JSON.stringify(schema);
}

/**
 * NewsArticle — новость (/news/<адрес>/): заголовок из h1, главное фото — первая картинка из /img/news/,
 * даты страницы (дата публикации — та, что видна на странице: «Новости · дд.мм.гггг»); автор и
 * издатель — компания (#organization есть в разметке каждой страницы).
 */
export function buildNewsArticleSchema(
  html: string,
  description: string | null,
  canonicalAbs: string,
  dates: { published?: string | null; modified?: string | null },
  site = DEFAULT_SITE,
): string | null {
  const h1 = html.match(/<h1[^>]*>([\s\S]+?)<\/h1>/);
  if (!h1) return null;
  const headline = decodeEntities(h1[1].replace(/<[^>]+>/g, ''));
  const img = html.match(/<img\b[^>]*?\bsrc="(\/img\/news\/[^"?]+)/);
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    // Google: заголовок статьи — до 110 знаков
    headline: headline.length > 110 ? `${headline.slice(0, 109).trimEnd()}…` : headline,
    description: description ?? headline,
    url: canonicalAbs,
    mainEntityOfPage: canonicalAbs,
    author: { '@id': `${site}/#organization` },
    publisher: { '@id': `${site}/#organization` },
  };
  if (img) schema.image = [`${site}${img[1]}`];
  if (dates.published) schema.datePublished = dates.published;
  // правка не раньше публикации
  const modified = dates.modified && dates.published && dates.modified < dates.published ? dates.published : (dates.modified ?? dates.published);
  if (modified) schema.dateModified = modified;
  return JSON.stringify(schema);
}

/** FAQPage — из блока вопросов (.faq__item) и панелей «Вопросы перед заказом». */
export function buildFaqSchema(html: string): string | null {
  const items: { q: string; a: string }[] = [];
  const re = /<details[^>]*class="faq__item"[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>\s*<p[^>]*class="faq__answer"[^>]*>([\s\S]*?)<\/p>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const q = decodeEntities(m[1].replace(/<[^>]+>/g, ''));
    const a = decodeEntities(m[2].replace(/<[^>]+>/g, ''));
    if (q && a) items.push({ q, a });
  }
  const panel = html.match(/<div class="cdoc__panel" id="[^"]*vopros[^"]*">([\s\S]*?)(?=<div class="cdoc__panel"|<\/div>\s*<\/div>)/);
  if (panel) {
    const qa = /<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/g;
    let p: RegExpExecArray | null;
    while ((p = qa.exec(panel[1])) !== null) {
      const q = decodeEntities(p[1].replace(/<[^>]+>/g, ''));
      const a = decodeEntities(p[2].replace(/<[^>]+>/g, ''));
      if (q.endsWith('?') && a) items.push({ q, a });
    }
  }
  if (items.length < 2) return null;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  });
}

/** Все JSON-LD страницы в порядке вывода: Breadcrumb, FAQ, Product, Article. offer — цена товара со склада. */
export function buildPageJsonLd(
  body: string,
  page: { path: string; title: string; description: string | null; publishedAt?: string | null; modifiedAt?: string | null },
  site = DEFAULT_SITE,
  offer?: StockOffer,
): string[] {
  const slug = page.path.replace(/^\/|\/$/g, '');
  const pageUrlAbs = `${site}/${slug}${slug ? '/' : ''}`;
  const canonicalAbs = slug ? `${site}/${slug.replace(/\/$/, '')}/` : `${site}/`;
  const out: string[] = [];
  const breadcrumb = buildBreadcrumbSchema(body, pageUrlAbs, site) || fallbackBreadcrumb(slug, page.title || '', pageUrlAbs, site);
  if (breadcrumb) out.push(breadcrumb);
  const faq = buildFaqSchema(body);
  if (faq) out.push(faq);
  const product = buildProductSchema(body, page.description, canonicalAbs, site, offer);
  if (product) out.push(product);
  const article = buildArticleSchema(body, page.description, canonicalAbs, {
    published: page.publishedAt ?? undefined,
    modified: page.modifiedAt ?? undefined,
  }, site);
  if (article) out.push(article);
  if (/^news\/[^/]+$/.test(slug)) {
    const news = buildNewsArticleSchema(body, page.description, canonicalAbs, { published: page.publishedAt, modified: page.modifiedAt }, site);
    if (news) out.push(news);
  }
  return out;
}
