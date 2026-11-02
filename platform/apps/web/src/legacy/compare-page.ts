/* compare-page.js — таблица сравнения на /sravnenie/.
 *
 * Берёт выбор из localStorage (его ведёт compare.js) и характеристики из
 * /data/compare-index.json — индекса, который собирается на сборке из таблиц
 * страниц товара (scripts/build-compare-index.mjs).
 *
 * Индекс весит сотни килобайт, поэтому грузится только здесь.
 *
 * Список позиций дописывается в поле «Задача» формы заявки — так менеджер
 * видит, что именно сравнивал клиент. Отдельное поле формы не подходит:
 * send.php читает фиксированный набор полей, незнакомые молча отбрасывает.
 */
type CompareItem = { url: string; name: string; image?: string; specs: Record<string, string> };
type CompareSection = { title: string; params: string[]; items: CompareItem[] };
type CompareIndex = { sections: Record<string, CompareSection> };

(function () {
  'use strict';

  var PREFIX = 'Сравнение';
  var root: HTMLElement, store: CompareStore;

  /* Хранилище ведёт compare.js, а он подключён в общем блоке скриптов —
     то есть ПОЗЖЕ этого файла в разметке. Ждём DOMContentLoaded: к этому
     моменту отработали оба defer-скрипта, и порядок тегов уже не важен. */
  if (document.readyState === 'complete') start();
  else document.addEventListener('DOMContentLoaded', start);

  function start() {
    root = document.getElementById('cmp-root')!;
    if (!root) return;
    store = window.uiCompare!;

    dressForm();   // тексты формы нужны и на пустой странице сравнения

    if (!store) {
      show('Сравнение недоступно: браузер заблокировал хранилище сайта.');
      return;
    }
    var data = store.read();
    if (!data || !data.items.length) {
      show('Вы пока ничего не выбрали. Отметьте «К сравнению» на карточках товара — '
         + 'здесь появится таблица характеристик.');
      return;
    }
    fetch('/data/compare-index.json?locale=' + ((location.pathname.match(/^\/(ru|kz|en)(?=\/)/) || [])[1] || 'ru'))
      .then(function (r) { if (!r.ok) throw new Error('index'); return r.json(); })
      .then(function (index) { render(index, store.read()); })
      .catch(function () { show('Не удалось загрузить характеристики. Обновите страницу.'); });
  }

  /* Пустое состояние и ошибки выглядят одинаково: текст и ссылка в каталог. */
  function show(message: string) {
    root.innerHTML =
      '<div class="cmp-empty">'
      + '<p class="cmp-empty__text">' + esc(message) + '</p>'
      + '<a class="btn btn--primary" href="/products/">Перейти в каталог '
      + '<span class="btn__arrow" aria-hidden="true">→</span></a>'
      + '</div>';
  }

  /* ── таблица ─────────────────────────────────────────────────────── */
  function render(index: CompareIndex, data: CompareSelection | null) {
    if (!data || !data.items.length) {
      show('В сравнении пусто. Отметьте «К сравнению» на карточках товара.');
      return;
    }
    var section = index.sections[data.section];
    if (!section) { show('Для этого раздела сравнение недоступно.'); return; }

    var byUrl: Record<string, CompareItem> = {};
    section.items.forEach(function (it) { byUrl[it.url] = it; });
    var picked = data.items.map(function (u) { return byUrl[u]; }).filter(Boolean);
    if (!picked.length) {
      store.clear();
      show('Выбранные позиции больше не доступны. Начните сравнение заново.');
      return;
    }

    // строки таблицы — параметры раздела, которые есть хотя бы у одной позиции
    var params = section.params.filter(function (p) {
      return picked.some(function (it) { return it.specs[p]; });
    });

    var html = '<p class="cmp-section-line">Раздел: <a href="' + esc(data.section) + '">'
      + esc(section.title) + '</a></p>'
      + '<div class="cmp-tools">'
      + '<label class="cmp-toggle"><input type="checkbox" id="cmp-diff"> '
      + '<span>Показать только отличия</span></label>'
      + '<button type="button" class="cmp-clear" id="cmp-clear">Очистить сравнение</button>'
      + '</div>'
      + '<div class="cmp-scroll"><table class="cmp-table"><thead><tr>'
      + '<th class="cmp-table__corner">Характеристика</th>';

    picked.forEach(function (it) {
      html += '<th class="cmp-col">'
        + '<button type="button" class="cmp-col__remove" data-remove="' + esc(it.url) + '" '
        + 'aria-label="Убрать из сравнения">×</button>'
        + (it.image ? '<a href="' + esc(it.url) + '" class="cmp-col__cover">'
            + '<img src="' + esc(it.image) + '" alt="' + esc(it.name) + '" loading="lazy"></a>' : '')
        + '<a class="cmp-col__name" href="' + esc(it.url) + '">' + esc(it.name) + '</a>'
        + '</th>';
    });
    html += '</tr></thead><tbody>';

    params.forEach(function (p) {
      var values = picked.map(function (it) { return it.specs[p] || ''; });
      var same = values.every(function (v) { return v === values[0]; });
      html += '<tr class="cmp-row' + (same ? ' is-same' : '') + '">'
        + '<th class="cmp-row__label">' + esc(p) + '</th>';
      values.forEach(function (v) {
        html += '<td' + (same ? '' : ' class="is-diff"') + '>' + (v ? esc(v) : '—') + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    root.innerHTML = html;
    fillTask(section, picked);

    document.getElementById('cmp-diff')!.addEventListener('change', function (this: HTMLInputElement) {
      root.querySelector('.cmp-table')!.classList.toggle('cmp-table--diff', this.checked);
    });
    document.getElementById('cmp-clear')!.addEventListener('click', function () {
      store.clear();
      location.reload();
    });
    ([].forEach as Function).call(root.querySelectorAll('[data-remove]'), function (btn: Element) {
      btn.addEventListener('click', function () {
        var d = store.read();
        if (!d) return;
        d.items = d.items.filter(function (u) { return u !== btn.getAttribute('data-remove'); });
        if (d.items.length) store.write(d); else store.clear();
        render(index, store.read());
      });
    });
  }

  /* ── список позиций в заявку ─────────────────────────────────────── */
  function fillTask(section: CompareSection, picked: CompareItem[]) {
    var ta = document.querySelector<HTMLTextAreaElement>('#cmp-form-wrap textarea[name="task"]');
    if (!ta) return;
    var lines = [PREFIX + ' (' + picked.length + ' поз.), раздел «' + section.title + '»:'];
    picked.forEach(function (it, i) {
      lines.push((i + 1) + '. ' + it.name + ' — uralinduktor.kz' + it.url);
    });
    // чем позиции отличаются — менеджеру это полезнее, чем первые попавшиеся
    // значения без названий параметров
    var diff = section.params.filter(function (p) {
      var vals = picked.map(function (it) { return it.specs[p] || ''; });
      return vals.some(function (v) { return v; })
          && !vals.every(function (v) { return v === vals[0]; });
    }).slice(0, 5);
    if (diff.length) lines.push('Отличия по: ' + diff.join(' · '));
    // ручной текст пользователя сохраняем под блоком сравнения
    var manual = ta.value.split('\n').filter(function (l) {
      return l.indexOf(PREFIX) !== 0 && !/^\d+\.\s/.test(l);
    }).join('\n').trim();
    ta.value = lines.join('\n') + (manual ? '\n\n' + manual : '');
  }

  /* ── тексты формы под задачу страницы ────────────────────────────── */
  /* Саму форму не копируем: она приходит общим блоком, чтобы не разъехаться
     с каноном (honeypot, скрытые поля, обработчик). Меняем только подписи
     и метку источника, которая уходит в Битрикс24. */
  function dressForm() {
    var wrap = document.getElementById('cmp-form-wrap');
    if (!wrap) return;
    var title = wrap.querySelector('.leadgen__title');
    if (title) title.innerHTML = 'Отправьте сравнение менеджеру '
      + '<em>на&nbsp;просчёт</em> — заполните форму';
    var lead = wrap.querySelector('.leadgen__lead');
    if (lead) lead.textContent = 'Выбранные позиции уйдут вместе с заявкой. '
      + 'Инженер уточнит задачу и предложит решение под ваше производство.';
    var submit = wrap.querySelector('.form__submit');
    if (submit) submit.innerHTML = 'Отправить менеджеру на&nbsp;просчёт '
      + '<span class="btn__arrow" aria-hidden="true">→</span>';
    var form = wrap.querySelector('form.js-lead-form');
    if (form) form.setAttribute('data-form', 'Сравнение товаров');
  }

  function esc(s: unknown): string {
    return String(s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c];
    });
  }
})();

import type { CompareSelection, CompareStore } from './globals';
