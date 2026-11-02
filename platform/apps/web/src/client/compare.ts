import { clearCompare, COMPARE_LIMIT, COMPARE_PAGE, exposeCompareApi, readCompare, subscribeCompare, toggleCompare } from '@mtpk/ui/browser/compare-store';
import { $, $$, delegate } from './dom';
import { withoutLocale } from './i18n';

const ICON =
  '<svg class="cmp-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v16M4 8h16M7 8l-3 6h6zM17 8l-3 6h6z"/></svg>';

const selected = () => readCompare()?.items ?? [];

function paint(btn: HTMLElement, active: boolean): void {
  btn.classList.toggle('is-active', active);
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  btn.innerHTML = `${ICON}<span>${active ? 'В сравнении' : 'К сравнению'}</span>`;
}

function paintAll(): void {
  const items = selected();
  for (const b of $$('[data-compare]')) paint(b, items.includes(b.dataset.compare ?? ''));
}

/** Нижняя панель «Сравнение: N / 4 · Сравнить · Очистить» (кроме самой /sravnenie/). */
function renderBar(): void {
  const items = selected();
  let bar = document.getElementById('cmp-bar');
  const onComparePage = withoutLocale(location.pathname).replace(/\/?$/, '/') === COMPARE_PAGE;
  if (onComparePage || !items.length) {
    bar?.remove();
    return;
  }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'cmp-bar';
    bar.className = 'cmp-bar';
    document.body.appendChild(bar);
  }
  bar.innerHTML = `<div class="cmp-bar__inner"><span class="cmp-bar__count">Сравнение: <b>${items.length}</b> / ${COMPARE_LIMIT}</span><a class="btn btn--primary cmp-bar__go" href="${COMPARE_PAGE}">Сравнить <span class="btn__arrow" aria-hidden="true">→</span></a><button type="button" class="cmp-bar__clear">Очистить</button></div>`;
  liftAboveCookie(bar);
}

/** Плашка cookie тоже внизу — панель сравнения поднимается над ней. */
function liftAboveCookie(bar: HTMLElement): void {
  const ck = document.getElementById('cookie-consent');
  bar.style.bottom = ck && !ck.hidden && ck.offsetHeight > 0 ? `${ck.offsetHeight}px` : '0px';
}

function cardUrl(card: Element): string {
  let href = card.querySelector('.pcard__title a, a.pcard__cover, a[href*="/products/"]')?.getAttribute('href') ?? '';
  if (!href) return '';
  if (!href.startsWith('/')) href = location.pathname.replace(/[^/]*$/, '') + href;
  return withoutLocale(href).replace(/\/?$/, '/');
}

/** Карточкам из блоков «HTML как есть» кнопки дорисовываем (в разделах со сравнением). */
async function mountLegacyButtons(): Promise<void> {
  const cards = $$('.pcard').filter((c) => !c.querySelector('[data-compare]'));
  if (!cards.length) return;
  const sections = (await fetch('/data/compare-sections.json')
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [])) as string[];
  if (!sections.includes(withoutLocale(location.pathname).replace(/\/?$/, '/'))) return;
  for (const card of cards) {
    const url = cardUrl(card);
    const box = card.querySelector('.pcard__actions') ?? card.querySelector('.pcard__body');
    if (!url || !box) continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cmp-btn';
    btn.dataset.compare = url;
    box.appendChild(btn);
  }
  paintAll();
}

/** «К сравнению»: выбор в localStorage (не больше 4, из одного раздела), панель внизу. */
export function initCompare(): void {
  exposeCompareApi();
  delegate('click', '[data-compare]', (btn, e) => {
    e.preventDefault();
    toggleCompare(btn.dataset.compare ?? '');
  });
  delegate('click', '.cmp-bar__clear', () => clearCompare());
  subscribeCompare(() => {
    paintAll();
    renderBar();
  });
  paintAll();
  renderBar();
  void mountLegacyButtons();
  window.addEventListener('cookie-consent-accepted', () => {
    const bar = $('#cmp-bar');
    if (bar) liftAboveCookie(bar);
  });
}
