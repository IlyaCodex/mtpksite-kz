/**
 * Согласие на cookie и аналитика. До «Принять» счётчики не запускаются;
 * после — стартуют при простое браузера или первом действии пользователя
 * (T-PERF-12). Во фрейме инструментов Метрики (Вебвизор, карты) — сразу.
 */
const KEY = 'ui_cookie_consent';
const CONSENT_VERSION = 'v2026.1';
// счётчик и проект прежнего uralinduktor.kz: история посещений продолжается в тех же кабинетах
const YM_COUNTERS = [111375860];
const ROISTAT_PROJECT = '55e30c285273fb0205de07d6cfbcb9ce';

type W = Window & { ym?: ((...args: unknown[]) => void) & { a?: unknown[]; l?: number }; roistatProjectId?: string; roistatHost?: string };

function hasConsent(): boolean {
  try {
    if (localStorage.getItem(KEY)) return true;
  } catch {
    /* приватный режим */
  }
  return new RegExp(`(?:^|; )${KEY}=`).test(document.cookie);
}

function inFrame(): boolean {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
}

function loadScript(src: string, id?: string): void {
  if (id && document.getElementById(id)) return;
  if (Array.from(document.scripts).some((s) => s.src === src)) return;
  const el = document.createElement('script');
  el.async = true;
  el.src = src;
  if (id) el.id = id;
  document.head.appendChild(el);
}

let started = false;
function startAnalytics(): void {
  if (started) return;
  started = true;
  const w = window as W;
  const ym = (w.ym ??= Object.assign(
    function (...args: unknown[]) {
      (ym.a ??= []).push(args);
    },
    { l: Date.now() },
  ) as NonNullable<W['ym']>);
  loadScript('https://mc.yandex.ru/metrika/tag.js');
  for (const id of YM_COUNTERS) {
    ym(id, 'init', { webvisor: true, clickmap: true, referrer: document.referrer, url: location.href, accurateTrackBounce: true, trackLinks: true });
  }
  w.roistatProjectId = ROISTAT_PROJECT;
  w.roistatHost = 'cloud.roistat.com';
  const visited = /(?:^|; )roistat_visit=/.test(document.cookie);
  loadScript(`https://cloud.roistat.com${visited ? '/dist/module.js' : `/api/site/1.0/${ROISTAT_PROJECT}/init?referrer=${encodeURIComponent(location.href)}`}`, 'roistat-code');
}

function scheduleAnalytics(): void {
  const events = ['pointerdown', 'touchstart', 'keydown', 'scroll'] as const;
  const start = () => {
    for (const ev of events) window.removeEventListener(ev, start);
    startAnalytics();
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 4000 });
  else globalThis.setTimeout(start, 2500);
  for (const ev of events) window.addEventListener(ev, start, { once: true, passive: true });
}

function accept(banner: HTMLElement): void {
  const value = `1|${CONSENT_VERSION}|${new Date().toISOString()}`;
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* без localStorage — останется cookie */
  }
  try {
    const d = new Date(Date.now() + 365 * 864e5);
    document.cookie = `${KEY}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
  } catch {
    /* cookie отключены */
  }
  banner.hidden = true;
  window.dispatchEvent(new Event('cookie-consent-accepted'));
  startAnalytics();
}

/**
 * Цели Метрики со статей Практикума: статья сообщает о действии событием ui-praktikum-event
 * (detail: { name, …параметры }) — цель с этим именем уходит во все счётчики. Засчитывается там, где в
 * Метрике заведена цель «JavaScript-событие» с таким идентификатором; без согласия на cookie счётчиков нет.
 */
function listenArticleGoals(): void {
  document.addEventListener('ui-praktikum-event', (e) => {
    const { name, ...params } = ((e as CustomEvent<unknown>).detail ?? {}) as Record<string, unknown>;
    const ym = (window as W).ym;
    if (typeof name !== 'string' || !/^[\w-]{1,64}$/.test(name) || typeof ym !== 'function') return;
    for (const id of YM_COUNTERS) ym(id, 'reachGoal', name, params);
  });
}

export function initConsent(): void {
  listenArticleGoals();
  if (inFrame()) return startAnalytics();
  const banner = document.getElementById('cookie-consent');
  if (hasConsent()) return scheduleAnalytics();
  if (!banner) return;
  banner.hidden = false;
  document.getElementById('cookie-accept')?.addEventListener('click', () => accept(banner), { once: true });
}
