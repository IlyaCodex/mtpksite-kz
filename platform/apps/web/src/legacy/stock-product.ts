/* ============================================================
   stock-product.js — отметка «В наличии» ВНУТРИ карточки товара (.phero).
   Источник: /data/stock.json (тот же файл, что питает /nalichie/ и бейджи
   каталога). Сопоставление — по slug текущего URL (после /products/).

   Правило (docs/stock-system.md §1, эффект 3): если позиция помечена на
   складе, то на её странице товара:
     1) бейдж «В наличии» поверх обложки (.phero__main, снизу-слева — как в
        каталоге, парность с stock-badges.js);
     2) пилюля-статус (.phero__status) показывает «В наличии · отгрузка от
        1 рабочего дня» вместо производственного срока «До N рабочих дней»
        (или item.shipping, если задан в stock.config.json).
   ============================================================ */
(function () {
  'use strict';

  var phero = document.querySelector('.phero');
  if (!phero) return;

  var m = location.pathname.match(/^(?:\/(?:ru|kz|en))?\/products\/(.+?)\/?$/);
  if (!m) return;
  var slug = m[1].replace(/\/+$/, '');

  fetch('/data/stock.json', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || !Array.isArray(data.items)) return;

      var item = null;
      for (var i = 0; i < data.items.length; i++) {
        var s = data.items[i] && data.items[i].slug;
        if (s && String(s).replace(/^\/+|\/+$/g, '') === slug) { item = data.items[i]; break; }
      }
      if (!item) return;

      var shipping = item.shipping || 'от 1 рабочего дня';

      // 1) Пилюля-статус: наличие + срок отгрузки (вместо срока производства).
      var status = phero!.querySelector('.phero__status');
      if (status) status.textContent = 'В наличии · отгрузка ' + shipping;

      // 2) Бейдж «В наличии» поверх обложки (снизу-слева, как в каталоге).
      var cover = phero!.querySelector('.phero__main');
      if (cover && !phero!.querySelector('.pcard__stock-badge')) {
        // Keep the stock link a sibling of the lightbox button, never a
        // focusable link inside another interactive control.
        var badgeHost = cover.parentElement!;
        if (!badgeHost.classList.contains('phero__stage')) {
          badgeHost = document.createElement('div');
          badgeHost.className = 'audit-stock-cover';
          cover.parentNode!.insertBefore(badgeHost, cover);
          badgeHost.appendChild(cover);
        }
        var badge = document.createElement('a');
        badge.className = 'pcard__stock-badge';
        badge.href = '/nalichie/';
        badge.setAttribute('aria-label', 'В наличии на складе');
        badge.textContent = 'В наличии';
        badgeHost.appendChild(badge);
      }

      phero!.setAttribute('data-stock', 'true');
    })
    .catch(function () { /* нет файла — молча выходим */ });
})();

export {};
