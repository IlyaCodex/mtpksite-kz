import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LOCALE, splitLocalePath } from '@mtpk/content-kit/i18n';
import type { PageListItem, RedirectDto } from '@mtpk/shared/contracts';

const CONTENT = process.env.CONTENT_URL ?? 'http://127.0.0.1:4101';
const SITE = (process.env.SITE_URL ?? 'https://uralinduktor.kz').replace(/\/$/, '');
const TTL_MS = 60_000;

/**
 * Карта редиректов и список адресов страниц — в памяти процесса, обновляются
 * раз в минуту. Если контент-сервис недоступен, работаем по последней копии.
 */
let state: { at: number; redirects: Map<string, RedirectDto>; paths: Set<string> } | null = null;
let loading: Promise<void> | null = null;

async function refresh(): Promise<void> {
  const [r, p] = await Promise.all([
    fetch(`${CONTENT}/v1/redirects`, { cache: 'no-store' }),
    fetch(`${CONTENT}/v1/pages`, { cache: 'no-store' }),
  ]);
  if (!r.ok || !p.ok) throw new Error('контент-сервис недоступен');
  const redirects = (await r.json()) as RedirectDto[];
  const pages = (await p.json()) as PageListItem[];
  state = {
    at: Date.now(),
    redirects: new Map(redirects.map((x) => [x.from, x])),
    paths: new Set(pages.map((x) => x.path)),
  };
}

async function getState() {
  if (!state || Date.now() - state.at > TTL_MS) {
    loading ??= refresh()
      .catch(() => {
        if (state) state.at = Date.now() - TTL_MS + 10_000; // повторить через 10 с
      })
      .finally(() => {
        loading = null;
      });
    if (!state) await loading;
  }
  return state;
}

function redirect(location: string, req: NextRequest, code = 301) {
  // В продакшне сайт стоит за шлюзом: абсолютный адрес строим от канонического
  // домена (как nginx), а не от внутреннего имени контейнера.
  const base = process.env.NODE_ENV === 'production' ? SITE : req.nextUrl.origin;
  const url = location.startsWith('http') ? location : new URL(location, base).toString();
  return NextResponse.redirect(url, code);
}

/**
 * «Спасибо» открывается после заявки: пропуск от формы (cookie ui_lead_sent на 15 минут — client/forms.ts)
 * или переход со страницы этого же сайта (вкладка, открытая до выкладки, пропуск ещё не ставит).
 */
function thanksAllowed(req: NextRequest): boolean {
  if (req.cookies.has('ui_lead_sent')) return true;
  const ref = req.headers.get('referer');
  if (!ref) return false;
  try {
    const host = new URL(ref).host;
    return host === req.headers.get('host') || host === new URL(SITE).host;
  } catch {
    return false;
  }
}

/**
 * Редиректы — как nginx старого сайта (порядок тот же):
 *  1. легаси-карта WordPress → новые адреса (точное совпадение пути, 301, без query);
 *  2. /index.html и …/index.html → адрес каталога;
 *  3. /sitemap.xml → /sitemap-index.xml;
 *  4. адрес без слеша на конце → со слешем, если такая страница есть;
 *  (после легаси-карты) адрес в другом регистре → страница в нижнем.
 * Языки: страницы живут под /ru/, /kz/, /en/; адрес без языка — на русскую версию (как на прежнем .kz),
 * легаси-карта и список страниц — по пути без языка.
 */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    /* битая кодировка — сравниваем как есть */
  }

  const index = pathname.match(/^(.*\/)index\.html$/);
  if (index) return redirect(`${index[1]}${search}`, req);

  if (pathname === '/sitemap.xml') return redirect(`${SITE}/sitemap-index.xml`, req);

  const isFile = /\.[a-z0-9]+$/i.test(pathname);
  const { locale, path } = splitLocalePath(decoded);
  const s = await getState();

  if (!locale) {
    // сюда приходит и внутренний адрес страницы «не найдена» (ниже, «Спасибо» без заявки)
    if (isFile || /^\/404\/?$/.test(decoded)) return NextResponse.next();
    const known = s?.redirects.get(decoded);
    const target = known ? known.to : decoded.endsWith('/') ? decoded : `${decoded}/`;
    return redirect(target.startsWith('http') ? target : `/${DEFAULT_LOCALE}${encodeURI(target)}${search}`, req, known?.code ?? 301);
  }
  const prefix = `/${locale}`;

  // /kz → /kz/
  if (decoded === prefix) return redirect(`${prefix}/${search}`, req);

  // «Спасибо» без заявки (адрес набран, закладка, бот) — обычная страница «не найдена» с кодом 404
  if (path === '/spasibo/' && !thanksAllowed(req)) return NextResponse.rewrite(new URL('/404', req.url), { status: 404 });

  const legacy = s?.redirects.get(path);
  if (legacy) return redirect(legacy.to.startsWith('http') ? legacy.to : `${prefix}${legacy.to}`, req, legacy.code);

  // адрес в другом регистре (/KONTAKTY/) — на страницу в нижнем: иначе у поисковиков дубль
  const lower = path.toLowerCase();
  if (lower !== path && s) {
    const target = s.paths.has(lower) ? lower : s.paths.has(`${lower}/`) ? `${lower}/` : null;
    if (target) return redirect(`${prefix}${encodeURI(target)}${search}`, req);
  }

  if (!pathname.endsWith('/') && !isFile && s?.paths.has(`${path}/`)) {
    return redirect(`${pathname}/${search}`, req);
  }
  return NextResponse.next();
}

export const config = {
  // Статика и сервисные адреса мимо прокси (у них своих легаси-адресов нет)
  matcher: ['/((?!_next/|img/|files/|docs/|og/|css/|js/|fonts/|brand/|data/|api/|admin(?:/|$)).*)'],
};
