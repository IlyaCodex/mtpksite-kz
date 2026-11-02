import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localizeHref, localizeHtml, localizeJsonLd, normalizeText, splitLocalePath, translateText } from './i18n.ts';

const dict = new Map([
  ['Индукционные печи', 'Индукциялық пештер'],
  ['Каталог оборудования', 'Жабдықтар каталогы'],
  ['Фото печи', 'Пеш суреті'],
]);

test('ключ словаря: неразрывные и мягкие переносы не мешают', () => {
  assert.equal(normalizeText(' Индукционные пе­чи\n '), 'Индукционные печи');
});

test('перевод сохраняет пробелы по краям, без перевода — строка как есть', () => {
  assert.equal(translateText(' Индукционные печи ', dict), ' Индукциялық пештер ');
  assert.equal(translateText('Новый текст', dict), 'Новый текст');
});

test('адреса: страницы — с языком; файлы, якоря, внешние и уже с языком — как есть', () => {
  assert.equal(localizeHref('/products/x/', 'kz'), '/kz/products/x/');
  assert.equal(localizeHref('/', 'en'), '/en/');
  assert.equal(localizeHref('/?q=1', 'en'), '/en/?q=1');
  for (const href of ['/img/a.png', '/files/a.pdf', '/api/send.php', '/assets/site.js', '/favicon.ico', '#top', 'https://a.kz/', '//a.kz/x', 'mailto:a@b.kz', '/kz/products/', '/ru/']) {
    assert.equal(localizeHref(href, 'kz'), href, href);
  }
});

test('адрес делится на язык и путь', () => {
  assert.deepEqual(splitLocalePath('/kz/products/x/'), { locale: 'kz', path: '/products/x/' });
  assert.deepEqual(splitLocalePath('/ru/'), { locale: 'ru', path: '/' });
  assert.deepEqual(splitLocalePath('/en'), { locale: 'en', path: '/' });
  assert.deepEqual(splitLocalePath('/products/'), { locale: null, path: '/products/' });
  assert.deepEqual(splitLocalePath('/rus/'), { locale: null, path: '/rus/' });
});

test('страница: текст, подписи и ссылки — на языке; код и файлы не тронуты', () => {
  const html = '<a href="/products/x/" title="Каталог оборудования"><img src="/img/a.png" alt="Фото печи"> Индукционные печи </a><script>var s = "Индукционные печи";</script>';
  assert.equal(
    localizeHtml(html, 'kz', dict),
    '<a href="/kz/products/x/" title="Жабдықтар каталогы"><img src="/img/a.png" alt="Пеш суреті"> Индукциялық пештер </a><script>var s = "Индукционные печи";</script>',
  );
});

test('русская версия: только приставка в адресах', () => {
  assert.equal(localizeHtml('<a href="/kontakty/">Индукционные печи</a>', 'ru', new Map()), '<a href="/ru/kontakty/">Индукционные печи</a>');
});

test('JSON-LD: подписи и адреса сайта на языке, служебные поля и файлы как есть', () => {
  const site = 'https://uralinduktor.kz';
  const ld = { '@type': 'Product', '@id': `${site}/#x`, name: 'Индукционные печи', url: `${site}/products/x/`, image: `${site}/img/a.png` };
  assert.deepEqual(localizeJsonLd(ld, 'kz', dict, site), { '@type': 'Product', '@id': `${site}/#x`, name: 'Индукциялық пештер', url: `${site}/kz/products/x/`, image: `${site}/img/a.png` });
  assert.equal(localizeJsonLd(JSON.stringify({ name: 'Индукционные печи' }), 'kz', dict, site), JSON.stringify({ name: 'Индукциялық пештер' }));
});
