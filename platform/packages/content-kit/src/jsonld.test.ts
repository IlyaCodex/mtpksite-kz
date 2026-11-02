import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildNewsArticleSchema, buildPageJsonLd, buildProductSchema } from './jsonld.ts';

const NEWS = `<section><h1 class="legal-hero__title">МТПК УралИндуктор отметили Юбилей!</h1>
<p>Новости · 03.06.2024</p><img src="/img/news/yubilej.png" alt="" srcset="/img/news/yubilej.png?w=480 480w"></section>`;

test('новость: NewsArticle с заголовком, фото, датами и компанией как автором', () => {
  const json = buildPageJsonLd(NEWS, {
    path: '/news/yubilej/',
    title: 'Юбилей',
    description: 'Отметили юбилей',
    publishedAt: '2024-06-03T07:00:00.000Z',
    modifiedAt: '2026-10-02T10:00:00.000Z',
  }).map((s) => JSON.parse(s));
  const news = json.find((x) => x['@type'] === 'NewsArticle');
  assert.ok(news, 'есть NewsArticle');
  assert.equal(news.headline, 'МТПК УралИндуктор отметили Юбилей!');
  assert.deepEqual(news.image, ['https://uralinduktor.kz/img/news/yubilej.png']);
  assert.equal(news.datePublished, '2024-06-03T07:00:00.000Z');
  assert.equal(news.dateModified, '2026-10-02T10:00:00.000Z');
  assert.deepEqual(news.author, { '@id': 'https://uralinduktor.kz/#organization' });
  assert.equal(news.mainEntityOfPage, 'https://uralinduktor.kz/news/yubilej/');
});

test('список новостей и другие разделы — без NewsArticle', () => {
  for (const path of ['/news/', '/kontakty/', '/news/a/b/']) {
    const types = buildPageJsonLd(NEWS, { path, title: 't', description: null }).map((s) => JSON.parse(s)['@type']);
    assert.ok(!types.includes('NewsArticle'), path);
  }
});

test('дата правки не раньше публикации; длинный заголовок — до 110 знаков', () => {
  const long = `<h1>${'Очень длинный заголовок новости '.repeat(6)}</h1>`;
  const news = JSON.parse(buildNewsArticleSchema(long, null, 'https://uralinduktor.kz/news/x/', { published: '2025-05-15', modified: '2025-01-01' })!);
  assert.equal(news.dateModified, '2025-05-15');
  assert.ok(news.headline.length <= 110);
  assert.ok(news.headline.endsWith('…'));
});

test('товар: image — только свои фото; без фото поле не заполняется (общая картинка сайта — не товар)', () => {
  const url = 'https://uralinduktor.kz/products/zapchasti/drobemetnoe/bolty/';
  const withPhoto = JSON.parse(buildProductSchema('<div class="product-overview"><h1>Болты</h1><div class="product-photo" data-zoom="/img/zp/bolty.png?v=2"></div></div>', null, url)!);
  assert.deepEqual(withPhoto.image, ['https://uralinduktor.kz/img/zp/bolty.png']);
  const noPhoto = JSON.parse(buildProductSchema('<div class="product-overview"><h1>Каретка тельфера</h1></div>', null, url)!);
  assert.equal(noPhoto['@type'], 'Product');
  assert.equal(noPhoto.image, undefined);
});

test('крошки пакетов 09.10.2026 (nav.crumbs, nav.uc-breadcrumbs): цепочка до текущей страницы', () => {
  const magnets = `<article class="ui-magnets"><nav class="crumbs" aria-label="Хлебные крошки"><a href="/">Главная</a><span aria-hidden="true">/</span><a href="/products/">Каталог</a><span aria-hidden="true">/</span><span>Доп оборудование</span><span aria-hidden="true">/</span><span>Грузоподъёмные электромагниты</span></nav><h1>Грузоподъёмные электромагниты</h1></article>`;
  const crumbs = JSON.parse(buildPageJsonLd(magnets, { path: '/products/gruzopodemnye-elektromagnity/', title: 'Электромагниты', description: null })[0]!);
  assert.equal(crumbs['@type'], 'BreadcrumbList');
  assert.deepEqual(
    crumbs.itemListElement.map((i: { name: string; item: string }) => [i.name, i.item]),
    [
      ['Главная', 'https://uralinduktor.kz/'],
      ['Каталог', 'https://uralinduktor.kz/products/'],
      ['Грузоподъёмные электромагниты', 'https://uralinduktor.kz/products/gruzopodemnye-elektromagnity/'],
    ],
  );
  const tigli = `<article class="uc"><nav class="uc-breadcrumbs" aria-label="Хлебные крошки"><a href="/">Главная</a> / <a href="/products/">Каталог</a> / <a href="/products/zapchasti/">Запчасти</a> / <span aria-current="page">Тигли</span></nav></article>`;
  const list = JSON.parse(buildPageJsonLd(tigli, { path: '/products/zapchasti/tigli/', title: 'Тигли', description: null })[0]!);
  assert.equal(list.itemListElement.length, 4);
  assert.equal(list.itemListElement[3].item, 'https://uralinduktor.kz/products/zapchasti/tigli/');
});

test('товар со склада с ценой: offers — AggregateOffer (наименьшая цена, рубли, число позиций, в наличии); без цены — без offers', () => {
  const html = '<section class="phero"><div class="phero__main"><img src="/img/p.webp"></div><h1 class="phero__title">Индукционная печь УИ-0.15Т-160</h1></section>';
  const url = 'https://uralinduktor.kz/products/induktsionnye-plavilnye-pechi/po-stali/ui-0-15t-160/';
  const withPrice = JSON.parse(buildProductSchema(html, null, url, undefined, { price: 1250000, priceFrom: false, offers: 1 })!);
  assert.deepEqual(withPrice.offers, { '@type': 'AggregateOffer', lowPrice: '1250000', priceCurrency: 'RUB', offerCount: '1', availability: 'https://schema.org/InStock' });
  const range = JSON.parse(buildProductSchema(html, null, url, undefined, { price: 1099000, maxPrice: 1400000, priceFrom: true, offers: 3 })!);
  assert.equal(range.offers.lowPrice, '1099000');
  assert.equal(range.offers.highPrice, '1400000');
  assert.equal(range.offers.offerCount, '3');
  assert.equal(JSON.parse(buildProductSchema(html, null, url)!).offers, undefined);
  // страница запчасти цену со склада не показывает — и в разметке её нет
  const spare = '<div class="product-overview"><h1>Конденсатор ЭЭВП</h1></div>';
  assert.equal(JSON.parse(buildProductSchema(spare, null, url, undefined, { price: 50000, priceFrom: false, offers: 1 })!).offers, undefined);
});
