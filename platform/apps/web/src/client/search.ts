import { $, inertOutside, trapTab } from './dom';
import { pageLocale, withoutLocale } from './i18n';

/**
 * Поиск по сайту — окно по кнопке-«лупе». Модуль грузится только по первому
 * клику (страницы его не скачивают заранее); окно создаётся тогда же.
 * До ввода — примеры запросов и разделы, после — результаты с разделом сайта
 * и фото; выбор стрелками, Enter — открыть, Esc — закрыть. Стили —
 * styles/search.css, данные — поисковый сервис (/api/search, PostgreSQL full-text).
 */
type Hit = { url: string; title: string; excerpt: string; image: string | null };

const ICON = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  page: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  catalog: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  stock: '<path d="M21 8l-9-5-9 5v8l9 5 9-5V8Z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  parts: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
};
const svg = (paths: string, cls = '') =>
  `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

/** До ввода: примеры запросов (по щелчку — в строку поиска) и главные разделы сайта. */
const EXAMPLES = ['Индукционная печь', 'Дробемёт', 'Чиллер', 'Градирня', 'Сталеразливочный ковш', 'Индуктор', 'Футеровка'];
const SECTIONS: [string, string, string][] = [
  ['Каталог', '/products/', ICON.catalog],
  ['Наличие', '/nalichie/', ICON.stock],
  ['Запчасти', '/products/zapchasti/', ICON.parts],
  ['Контакты', '/kontakty/', ICON.phone],
];

/** Раздел сайта по адресу результата — подпись над заголовком. */
const SECTION_OF: [RegExp, string][] = [
  [/^\/products\/zapchasti\//, 'Запчасти'],
  [/^\/products\//, 'Каталог'],
  [/^\/uslugi\//, 'Услуги'],
  [/^\/news\//, 'Новости'],
  [/^\/proekty\//, 'Проекты'],
  [/^\/nalichie\//, 'Наличие'],
];
const sectionOf = (url: string) => {
  const path = withoutLocale(new URL(url, location.origin).pathname);
  return SECTION_OF.find(([re]) => re.test(path))?.[1] ?? 'Страница';
};

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** Фрагмент из поиска: весь текст экранируется, остаётся только подсветка совпадений <mark>. */
const excerptHtml = (s: string) => escapeHtml(s).replace(/&lt;(\/?)mark&gt;/g, '<$1mark>');

const TEMPLATE = `<div class="search-modal__backdrop" data-search-close></div>
<div class="search-modal__panel" role="dialog" aria-modal="true" aria-label="Поиск по сайту">
  <div class="ss-searchbar">
    ${svg(ICON.search, 'ss-searchbar__icon')}
    <input type="search" id="ss-input" class="ss-searchbar__input" placeholder="Оборудование, запчасти, статьи…" autocomplete="off" spellcheck="false" enterkeyhint="search" role="combobox" aria-autocomplete="list" aria-controls="ss-list" aria-expanded="false" aria-label="Поиск по сайту">
    <button class="ss-searchbar__reset" type="button" aria-label="Очистить запрос" hidden>${svg(ICON.close)}</button>
    <button class="ss-searchbar__close" type="button" aria-label="Закрыть поиск" data-search-close>${svg(ICON.close)}</button>
  </div>
  <div class="ss-progress" aria-hidden="true"></div>
  <div id="ss-status" class="audit-search-status" role="status" aria-live="polite" aria-atomic="true"></div>
  <div class="ss-body">
    <div class="ss-start" id="ss-start">
      <div class="ss-group">
        <p class="ss-group__title">Например</p>
        <div class="ss-chips">${EXAMPLES.map((q) => `<button type="button" class="ss-chip" data-q="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join('')}</div>
      </div>
      <div class="ss-group">
        <p class="ss-group__title">Разделы</p>
        <div class="ss-sections">${SECTIONS.map(([label, href, icon]) => `<a class="ss-section" href="${href}">${svg(icon)}${label}</a>`).join('')}</div>
      </div>
    </div>
    <div class="ss-results" id="ss-results" hidden>
      <div class="ss-list" id="ss-list" role="listbox" aria-label="Результаты поиска"></div>
      <div class="ss-empty" id="ss-empty" hidden></div>
    </div>
  </div>
  <div class="ss-foot">
    <span class="ss-count" id="ss-count"></span>
    <span class="ss-keys" aria-hidden="true"><span><kbd class="ss-kbd">↑</kbd><kbd class="ss-kbd">↓</kbd> выбор</span><span><kbd class="ss-kbd">Enter</kbd> открыть</span><span><kbd class="ss-kbd">Esc</kbd> закрыть</span></span>
  </div>
</div>`;

/** Отсев шумных совпадений: каждое слово запроса (по первым 3 буквам) — в заголовке или фрагменте. */
function relevant(hit: Hit, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
  const hay = `${hit.title} ${hit.excerpt.replace(/<[^>]+>/g, '')}`.toLowerCase();
  return words.every((w) => hay.includes(w.length >= 3 ? w.slice(0, 3) : w));
}

/** Закрытие с анимацией — столько же, сколько CSS-переход (--duration-base). */
const CLOSE_MS = 250;

let modal: HTMLElement | null = null;
let restore: (() => void) | null = null;
let opener: Element | null = null;
let lastQuery = '';
let timer = 0;
let hideTimer = 0;
let active = -1;

const input = () => $<HTMLInputElement>('#ss-input', modal!)!;
const cards = () => [...modal!.querySelectorAll<HTMLAnchorElement>('#ss-list .ss-card')];

/** Выбранный стрелками результат: подсветка, aria-activedescendant, прокрутка к нему. */
function select(i: number): void {
  const list = cards();
  active = list.length ? (i + list.length) % list.length : -1;
  list.forEach((c, k) => {
    c.classList.toggle('is-active', k === active);
    c.setAttribute('aria-selected', String(k === active));
  });
  const field = input();
  if (active >= 0) {
    field.setAttribute('aria-activedescendant', list[active].id);
    list[active].scrollIntoView({ block: 'nearest' });
  } else field.removeAttribute('aria-activedescendant');
}

function render(q: string, hits: Hit[] | 'error' | null): void {
  if (!modal) return;
  const start = $('#ss-start', modal)!;
  const results = $('#ss-results', modal)!;
  const status = $('#ss-status', modal)!;
  const count = $('#ss-count', modal)!;
  const list = $('#ss-list', modal)!;
  const empty = $('#ss-empty', modal)!;
  modal.querySelector('.search-modal__panel')!.classList.remove('is-loading');
  active = -1;
  input().removeAttribute('aria-activedescendant');
  if (hits === null) {
    start.hidden = false;
    results.hidden = true;
    list.innerHTML = '';
    count.textContent = '';
    status.textContent = '';
    input().setAttribute('aria-expanded', 'false');
    return;
  }
  start.hidden = true;
  results.hidden = false;
  if (hits === 'error') {
    list.innerHTML = '';
    count.textContent = '';
    empty.hidden = false;
    empty.innerHTML = '<p class="ss-empty__title">Поиск временно недоступен</p><p class="ss-empty__hint">Попробуйте позже или <a href="/kontakty/">свяжитесь с&nbsp;нами</a>.</p>';
    status.textContent = 'Поиск временно недоступен';
    input().setAttribute('aria-expanded', 'false');
    return;
  }
  list.innerHTML = hits
    .map((d, i) => {
      const thumb = d.image
        ? `<img src="${escapeHtml(d.image)}${d.image.includes('?') ? '&' : '?'}w=160" alt="" loading="lazy" decoding="async">`
        : svg(ICON.page);
      return `<a class="ss-card" id="ss-opt-${i}" role="option" aria-selected="false" href="${escapeHtml(d.url)}"><span class="ss-card__thumb">${thumb}</span><span class="ss-card__body"><span class="ss-card__section">${sectionOf(d.url)}</span><span class="ss-card__title">${escapeHtml(d.title || d.url)}</span><span class="ss-card__excerpt">${excerptHtml(d.excerpt)}</span></span>${svg(ICON.arrow, 'ss-card__go')}</a>`;
    })
    .join('');
  empty.hidden = hits.length > 0;
  empty.innerHTML = hits.length
    ? ''
    : `<p class="ss-empty__title">Ничего не&nbsp;нашлось по&nbsp;запросу «<span>${escapeHtml(q)}</span>»</p><p class="ss-empty__hint">Проверьте написание или <a href="/kontakty/">спросите инженера</a>&nbsp;— подберём оборудование под&nbsp;задачу.</p>`;
  count.textContent = hits.length ? `Найдено: ${hits.length}` : '';
  status.textContent = hits.length ? `Найдено: ${hits.length}` : 'Ничего не найдено';
  input().setAttribute('aria-expanded', String(hits.length > 0));
}

function query(q: string): void {
  lastQuery = q;
  window.clearTimeout(timer);
  $('.ss-searchbar__reset', modal!)!.hidden = q.length === 0;
  if (q.trim().length < 2) return render(q, null);
  timer = window.setTimeout(async () => {
    modal?.querySelector('.search-modal__panel')!.classList.add('is-loading');
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=40&locale=${pageLocale()}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { results: Hit[] };
      if (q === lastQuery) render(q, data.results.filter((d) => relevant(d, q)));
    } catch {
      if (q === lastQuery) render(q, 'error');
    }
  }, 160);
}

function close(): void {
  if (!modal || modal.hidden || !modal.classList.contains('is-open')) return;
  const el = modal;
  el.classList.remove('is-open');
  document.documentElement.style.overflow = '';
  restore?.();
  restore = null;
  if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  hideTimer = window.setTimeout(() => (el.hidden = true), still ? 0 : CLOSE_MS);
}

function create(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'search-modal';
  el.id = 'search-modal';
  el.hidden = true;
  el.innerHTML = TEMPLATE;
  document.body.appendChild(el);
  const field = $<HTMLInputElement>('#ss-input', el)!;
  field.addEventListener('input', () => query(field.value));
  el.addEventListener('click', (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (t?.closest('[data-search-close]')) return close();
    const chip = t?.closest<HTMLElement>('[data-q]');
    if (chip) {
      field.value = chip.dataset.q ?? '';
      query(field.value);
      field.focus();
    }
    if (t?.closest('.ss-searchbar__reset')) {
      field.value = '';
      query('');
      field.focus();
    }
  });
  el.addEventListener('mousemove', (e) => {
    const card = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('.ss-card') : null;
    const i = card ? cards().indexOf(card) : -1;
    if (i >= 0 && i !== active) select(i);
  });
  document.addEventListener('keydown', (e) => {
    if (el.hidden || !el.classList.contains('is-open')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!cards().length) return;
      e.preventDefault();
      select(active < 0 ? (e.key === 'ArrowDown' ? 0 : -1) : active + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Enter' && document.activeElement === field) {
      const target = cards()[active >= 0 ? active : 0];
      if (target) {
        e.preventDefault();
        target.click();
      }
    } else trapTab(e, el);
  });
  return el;
}

export function openSearch(q?: string): void {
  modal ??= create();
  if (!modal.hidden && modal.classList.contains('is-open')) return;
  window.clearTimeout(hideTimer);
  opener = document.activeElement;
  modal.hidden = false;
  document.documentElement.style.overflow = 'hidden';
  restore = inertOutside(modal);
  // кадр с начальным состоянием — затем класс: окно плавно проявляется (styles/search.css)
  void modal.offsetWidth;
  modal.classList.add('is-open');
  const field = input();
  if (q !== undefined) {
    field.value = q;
    query(q);
  }
  field.focus();
}
