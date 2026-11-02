/* ============================================================
   stock-badges.js — бейдж «В наличии» на карточках товара каталога.
   Источник: /data/stock.json (тот же файл, что питает /nalichie/).
   Сопоставление: по фрагменту slug (после /products/) в href карточки.
   ============================================================ */
(function () {
  'use strict';
  var cards = document.querySelectorAll('article.pcard a[href*="/products/"]');
  if (!cards.length) return;

  fetch('/data/stock.json', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || !Array.isArray(data.items)) return;
      // map: slug-фрагмент → true
      var inStock = Object.create(null);
      data.items.forEach(function (it: { slug?: string } | null) {
        if (it && it.slug) inStock[String(it.slug).replace(/^\/+|\/+$/g, '')] = true;
      });
      if (!Object.keys(inStock).length) return;

      var seen = new Set();
      cards.forEach(function (a) {
        var card = a.closest('article.pcard');
        if (!card || seen.has(card)) return;
        // вытаскиваем slug — то, что между /products/ и (опц.) хвостовым /
        var m = a.getAttribute('href')!.match(/^(?:\/(?:ru|kz|en))?\/products\/(.+?)\/?$/);
        if (!m) return;
        var slug = m[1].replace(/\/+$/, '');
        if (!inStock[slug]) return;
        seen.add(card);
        // ставим бейдж в обложку карточки
        var cover = card.querySelector<HTMLElement>('.pcard__cover');
        if (!cover) return;
        if (cover.querySelector('.pcard__stock-badge')) return; // уже есть
        var badge = document.createElement('a');
        badge.className = 'pcard__stock-badge';
        badge.href = '/nalichie/';
        badge.setAttribute('aria-label', 'В наличии на складе');
        badge.textContent = 'В\u00A0наличии';
        // обложка должна быть position: relative — гарантируем
        if (getComputedStyle(cover).position === 'static') cover.style.position = 'relative';
        cover.appendChild(badge);
        card.setAttribute('data-stock', 'true');
      });
    })
    .catch(function () { /* нет файла — молча выходим */ });
})();

export {};
