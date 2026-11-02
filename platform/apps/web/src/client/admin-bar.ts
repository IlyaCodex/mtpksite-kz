/**
 * Панель администратора на сайте (как у WordPress): видна только тем, кто
 * вошёл в админку. Сайт узнаёт это по флажку mtpk_bar (ставит админка при
 * входе, без секретов), данные — /admin/api/v1/site-bar (нужна сессия
 * админки). Модуль грузится только при флажке: посетителям — ни кода, ни
 * запросов.
 *
 * Что на панели: в админку; «Редактировать страницу/товар»; категория в
 * каталоге; «Добавить» (страницу, товар сюда); заявки за сегодня (и
 * недоставленные); SEO страницы; «Обновить на сайте» (сбросить кеш страницы);
 * когда изменена; меню пользователя (медиатека, настройки, выход); «Скрыть».
 */
import { icon, type IconName } from './admin-bar-icons';
import { withoutLocale } from './i18n';

type Link = { label: string; href: string };
type Bar = {
  user: { name: string; role: string };
  page: {
    title: string;
    status: 'published' | 'draft';
    kind: 'page' | 'document';
    updatedAt: string;
    edit: string;
    editLabel: string;
    seo: { title: string; description: string; noindex: boolean; level: 'ok' | 'warn' | 'bad'; notes: string[]; href: string };
    catalog: Link | null;
    addProduct: Link | null;
  } | null;
  leads: { today: number; failed: number; href: string } | null;
  links: { admin: string; newPage?: string; catalog?: string; settings?: string; media?: string };
  canPurge: boolean;
};

const API = '/admin/api/v1';
const HIDDEN = 'mtpk-bar-hidden';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dropCookie = () => {
  document.cookie = 'mtpk_bar=; path=/; max-age=0; samesite=lax';
};

const STYLE = `
html.has-adminbar{margin-top:40px!important}
html.has-adminbar .header-shell{top:40px}
html.has-adminbar .megamenu{top:calc(40px + 36px + 68px)}
html.has-adminbar .cdoc__nav{top:calc(var(--site-header-h,116px) + 56px);max-height:calc(100vh - var(--site-header-h,116px) - 72px)}
html.has-adminbar .cdoc__panel{scroll-margin-top:calc(var(--site-header-h,116px) + 56px)}
.mtpk-ab{position:fixed;inset:0 0 auto;height:40px;z-index:390;display:flex;align-items:center;gap:2px;padding:0 8px;background:#0a1c25;color:#dde9ee;box-shadow:0 4px 16px rgba(10,28,37,.25);font:500 13px/1 var(--font-body,system-ui),-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:0;text-transform:none}
.mtpk-ab *{box-sizing:border-box}
.mtpk-ab svg{width:18px;height:18px;flex:none}
.mtpk-ab a,.mtpk-ab button{all:unset;display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 10px;border-radius:8px;color:inherit;cursor:pointer;white-space:nowrap}
.mtpk-ab a:hover,.mtpk-ab button:hover,.mtpk-ab .is-open>button{background:#122f3d;color:#fff}
.mtpk-ab a:focus-visible,.mtpk-ab button:focus-visible{outline:2px solid #bad2dc;outline-offset:1px}
.mtpk-ab__brand{font-weight:700;color:#fff!important}
.mtpk-ab .mtpk-ab__primary{background:#1f5e78;color:#fff}
.mtpk-ab .mtpk-ab__primary:hover{background:#1a4d62}
.mtpk-ab__sep{width:1px;height:20px;margin:0 6px;background:rgba(221,233,238,.16)}
.mtpk-ab__spacer{flex:1}
.mtpk-ab__meta{padding:0 10px;color:#bad2dc;font-weight:400;white-space:nowrap}
.mtpk-ab__draft{padding:4px 8px;border-radius:6px;background:#fbbf24;color:#422006;font-weight:600}
.mtpk-ab__badge{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#4fab3a;color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center}
.mtpk-ab__badge--bad{background:#dc2626}
.mtpk-ab__dot{width:8px;height:8px;border-radius:50%;background:#4fab3a}
.mtpk-ab__dot--warn{background:#fbbf24}
.mtpk-ab__dot--bad{background:#ef4444}
.mtpk-ab__menu{position:relative}
.mtpk-ab__drop{display:none;position:absolute;top:38px;left:0;min-width:230px;padding:6px;border-radius:12px;background:#fff;color:#0f172a;box-shadow:0 14px 40px rgba(10,28,37,.28);font-weight:400}
.mtpk-ab__drop--right{left:auto;right:0}
.mtpk-ab .is-open>.mtpk-ab__drop{display:block}
.mtpk-ab__drop a,.mtpk-ab__drop button{display:flex;width:100%;height:auto;padding:9px 10px;color:#0f172a}
.mtpk-ab__drop a:hover,.mtpk-ab__drop button:hover{background:#eef4f7;color:#0f172a}
.mtpk-ab__drop svg{color:#1f5e78}
.mtpk-ab__head{padding:8px 10px 6px;color:#64748b;font-size:12px}
.mtpk-ab__seo{width:340px;padding:12px}
.mtpk-ab__seo dt{margin:8px 0 3px;color:#64748b;font-size:12px}
.mtpk-ab__seo dd{margin:0;line-height:1.4}
.mtpk-ab__seo ul{margin:10px 0 4px;padding-left:18px;color:#b45309;line-height:1.4}
.mtpk-ab__seo .mtpk-ab__ok{margin-top:10px;color:#15803d}
.mtpk-ab__seo a{margin-top:8px;color:#1f5e78;font-weight:600}
.mtpk-ab__toast{position:fixed;top:48px;right:12px;z-index:391;padding:10px 14px;border-radius:10px;background:#0a1c25;color:#fff;font:500 13px/1.3 system-ui,sans-serif;box-shadow:0 10px 30px rgba(10,28,37,.3)}
.mtpk-ab-restore{all:unset;position:fixed;top:8px;left:8px;z-index:390;width:30px;height:30px;border-radius:50%;background:#0a1c25;color:#dde9ee;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:.55;box-shadow:0 4px 14px rgba(10,28,37,.3)}
.mtpk-ab-restore:hover{opacity:1}
.mtpk-ab-restore svg{width:16px;height:16px}
@media (max-width:900px){.mtpk-ab__label{display:none}.mtpk-ab__meta{display:none}}
@media print{.mtpk-ab,.mtpk-ab-restore{display:none!important}html.has-adminbar{margin-top:0!important}}
`;

const item = (name: IconName, label: string, attrs: string) => `<a ${attrs}>${icon(name)}<span class="mtpk-ab__label">${esc(label)}</span></a>`;
const when = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function render(bar: Bar): string {
  const p = bar.page;
  const add = [bar.links.newPage && item('page', 'Страницу', `href="${esc(bar.links.newPage)}"`), p?.addProduct && item('catalog', p.addProduct.label, `href="${esc(p.addProduct.href)}"`)].filter(Boolean);
  const seoLevel = p ? { ok: '', warn: ' mtpk-ab__dot--warn', bad: ' mtpk-ab__dot--bad' }[p.seo.level] : '';
  const leads = bar.leads;
  return `
<a class="mtpk-ab__brand" href="${esc(bar.links.admin)}" title="Админка">${icon('admin')}<span class="mtpk-ab__label">УралИндуктор</span></a>
<span class="mtpk-ab__sep"></span>
${p ? item('edit', p.editLabel, `class="mtpk-ab__primary" href="${esc(p.edit)}"`) : ''}
${p?.catalog ? item('catalog', p.catalog.label, `href="${esc(p.catalog.href)}"`) : ''}
${
  add.length
    ? `<div class="mtpk-ab__menu"><button type="button" data-menu aria-haspopup="true" aria-expanded="false">${icon('add')}<span class="mtpk-ab__label">Добавить</span>${icon('down')}</button>
  <div class="mtpk-ab__drop">${add.join('')}</div></div>`
    : ''
}
${
  leads
    ? `<a href="${esc(leads.href)}" title="${leads.failed ? `Не доставлено в CRM и почту: ${leads.failed}` : 'Заявки за сегодня'}">${icon('leads')}<span class="mtpk-ab__label">Заявки</span>${
        leads.today ? `<span class="mtpk-ab__badge">${leads.today}</span>` : ''
      }${leads.failed ? `<span class="mtpk-ab__badge mtpk-ab__badge--bad" title="не доставлено">!</span>` : ''}</a>`
    : ''
}
${
  p
    ? `<div class="mtpk-ab__menu"><button type="button" data-menu aria-haspopup="true" aria-expanded="false"><span class="mtpk-ab__dot${seoLevel}"></span><span class="mtpk-ab__label">SEO</span></button>
  <div class="mtpk-ab__drop mtpk-ab__seo"><dl>
    <dt>Заголовок (title) · ${p.seo.title.length} знаков</dt><dd>${esc(p.seo.title || '—')}</dd>
    <dt>Описание (description) · ${p.seo.description.length} знаков</dt><dd>${esc(p.seo.description || '—')}</dd>
  </dl>${p.seo.notes.length ? `<ul>${p.seo.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : '<div class="mtpk-ab__ok">Заголовок и описание в порядке</div>'}
  <a href="${esc(p.seo.href)}">Изменить SEO →</a></div></div>`
    : ''
}
${p && bar.canPurge ? `<button type="button" data-act="purge" title="Показать последние правки сразу, не дожидаясь обновления кеша">${icon('refresh')}<span class="mtpk-ab__label">Обновить на сайте</span></button>` : ''}
<span class="mtpk-ab__spacer"></span>
${p?.status === 'draft' ? '<span class="mtpk-ab__draft">Черновик</span>' : ''}
${p ? `<span class="mtpk-ab__meta">изменена ${esc(when(p.updatedAt))}</span>` : ''}
<div class="mtpk-ab__menu"><button type="button" data-menu aria-haspopup="true" aria-expanded="false">${icon('user')}<span class="mtpk-ab__label">${esc(bar.user.name)}</span>${icon('down')}</button>
  <div class="mtpk-ab__drop mtpk-ab__drop--right">
    <div class="mtpk-ab__head">${esc(bar.user.name)} · ${esc(bar.user.role)}</div>
    ${item('admin', 'Обзор админки', `href="${esc(bar.links.admin)}"`)}
    ${bar.links.catalog ? item('catalog', 'Каталог продукции', `href="${esc(bar.links.catalog)}"`) : ''}
    ${bar.links.media ? item('media', 'Медиатека', `href="${esc(bar.links.media)}"`) : ''}
    ${bar.links.settings ? item('settings', 'Шапка, меню, контакты', `href="${esc(bar.links.settings)}"`) : ''}
    <button type="button" data-act="logout">${icon('logout')}<span>Выйти из админки</span></button>
  </div></div>
<button type="button" data-act="hide" title="Скрыть панель до закрытия вкладки">${icon('close')}</button>`;
}

function toast(text: string): void {
  const t = document.createElement('div');
  t.className = 'mtpk-ab__toast';
  t.textContent = text;
  document.body.append(t);
  setTimeout(() => t.remove(), 3500);
}

/** Запрос в админку с сайта: тот же адрес (/admin), cookie админки уходят сами. */
const post = (path: string, json?: unknown) =>
  fetch(`${API}/${path}`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(json ?? {}) });

function closeMenus(root: HTMLElement, except?: Element | null): void {
  root.querySelectorAll('.mtpk-ab__menu.is-open').forEach((m) => {
    if (m === except) return;
    m.classList.remove('is-open');
    m.querySelector('[data-menu]')?.setAttribute('aria-expanded', 'false');
  });
}

function mount(bar: Bar): void {
  const root = document.createElement('nav');
  root.className = 'mtpk-ab';
  root.setAttribute('aria-label', 'Панель администратора');
  root.innerHTML = render(bar);
  document.body.prepend(root);
  document.documentElement.classList.add('has-adminbar');

  root.addEventListener('click', async (e) => {
    const target = e.target as Element;
    const menuBtn = target.closest('[data-menu]');
    if (menuBtn) {
      const menu = menuBtn.parentElement!;
      const open = !menu.classList.contains('is-open');
      closeMenus(root, menu);
      menu.classList.toggle('is-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      return;
    }
    const act = target.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'hide') {
      try {
        sessionStorage.setItem(HIDDEN, '1');
      } catch {
        /* без sessionStorage — только до перезагрузки */
      }
      unmount(root);
      restoreButton();
    } else if (act === 'purge') {
      const res = await post('content/cache/purge', { paths: [withoutLocale(location.pathname)] }).catch(() => null);
      if (res?.ok) {
        toast('Страница обновлена — показываю свежую версию');
        setTimeout(() => location.reload(), 700);
      } else toast('Не получилось обновить страницу — попробуйте из админки');
    } else if (act === 'logout') {
      await post('auth/logout').catch(() => null);
      dropCookie();
      unmount(root);
      toast('Вы вышли из админки');
    }
  });
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target as Node)) closeMenus(root);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenus(root);
  });
}

function unmount(root: HTMLElement): void {
  root.remove();
  document.documentElement.classList.remove('has-adminbar');
}

/** Скрытая панель: маленькая кнопка в углу — вернуть. */
function restoreButton(): void {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'mtpk-ab-restore';
  b.title = 'Показать панель администратора';
  b.innerHTML = icon('admin');
  b.addEventListener('click', () => {
    try {
      sessionStorage.removeItem(HIDDEN);
    } catch {
      /* ничего */
    }
    b.remove();
    void mountAdminBar();
  });
  document.body.append(b);
}

export async function mountAdminBar(): Promise<void> {
  if (!document.getElementById('mtpk-ab-style')) {
    const style = document.createElement('style');
    style.id = 'mtpk-ab-style';
    style.textContent = STYLE;
    document.head.append(style);
  }
  let hidden = false;
  try {
    hidden = sessionStorage.getItem(HIDDEN) === '1';
  } catch {
    /* ничего */
  }
  if (hidden) return restoreButton();
  const res = await fetch(`${API}/site-bar?path=${encodeURIComponent(withoutLocale(location.pathname))}`, { credentials: 'same-origin', headers: { accept: 'application/json' } }).catch(() => null);
  // сессия кончилась (или админки нет) — флажок больше не нужен
  if (res && (res.status === 401 || res.status === 404)) return dropCookie();
  if (!res?.ok) return;
  mount((await res.json()) as Bar);
}
