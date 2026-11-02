import Link from 'next/link';
import type { ReactNode } from 'react';
import { BLOCK_LABELS, type Block } from '@mtpk/content-model';
import { AreaChart, BarList, Donut, PALETTE, Sparkline, StackBar } from '@/components/charts';
import { Icon, type IconName } from '@/components/icons';
import { Badge, cx, formatBytes, formatDate, Stat } from '@/components/ui';
import { actionTone, describeAction } from '@/lib/audit-labels';
import { can, requireUser } from '@/lib/auth';
import { plural } from '@/lib/catalog';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { CAMPAIGN_STATUS, pct, type MailingSummary } from '@/lib/mailing';
import { serviceBase, serviceJson, type Service } from '@/lib/services';

type ContentStats = {
  pages: number;
  documents: number;
  drafts: number;
  editedInAdmin: number;
  blocks: number;
  htmlBlocks: number;
  byType: Record<string, number>;
  redirects: number;
  stock: number;
};
type LeadStats = {
  days: number;
  byStatus: Record<string, number>;
  byDay: { day: string; count: number }[];
  total: number;
  period: number;
  previous: number;
  today: number;
  bySource: { name: string; count: number }[];
  byPage: { page: string; count: number }[];
  mail: Record<string, number>;
  b24: Record<string, number>;
  rejects: { reason: string; count: number }[];
};
type MediaFolder = { folder: string; files: number; bytes: bigint };

const PERIODS = [7, 30, 90] as const;
const TZ = 'Asia/Yekaterinburg';
const SERVICES: { id: Service; label: string }[] = [
  { id: 'content', label: 'Контент' },
  { id: 'leads', label: 'Заявки' },
  { id: 'media', label: 'Медиа' },
  { id: 'search', label: 'Поиск' },
];

/** Данные одного источника; недоступен — null (карточка покажет прочерк). */
const safe = <T,>(p: Promise<T>) => p.catch(() => null);
const fmt = (n: number) => n.toLocaleString('ru-RU');
const dayKey = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: TZ });

async function health(id: Service): Promise<{ ok: boolean; ms: number }> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${serviceBase(id)}/health`, { cache: 'no-store', signal: AbortSignal.timeout(1500) });
    return { ok: res.ok, ms: Date.now() - t0 };
  } catch {
    return { ok: false, ms: Date.now() - t0 };
  }
}

/** Карточка обзора с заголовком и ссылкой справа. */
function Panel({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-2xl border border-slate-200/80 bg-white shadow-xs', className)}>
      <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-1">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {action}
      </header>
      <div className="px-5 pt-3 pb-5">{children}</div>
    </section>
  );
}

const More = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800">
    {children}
    <Icon name="right" className="h-3.5 w-3.5" />
  </Link>
);

/** Показатель: значок, число, изменение к прошлому периоду, мини-график. */
function Kpi({
  icon,
  label,
  value,
  sub,
  delta,
  spark,
  tone = 'brand',
  href,
}: {
  icon: IconName;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  delta?: { pct: number | null; text: string } | null;
  spark?: ReactNode;
  tone?: 'brand' | 'accent' | 'amber' | 'red' | 'slate';
  href?: string;
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    accent: 'bg-accent-50 text-accent-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className={cx('inline-flex h-10 w-10 items-center justify-center rounded-xl', tones[tone])}>
          <Icon name={icon} duotone className="h-[22px] w-[22px]" />
        </span>
        {spark && <span className={tone === 'red' ? 'text-red-500' : 'text-brand-500'}>{spark}</span>}
      </div>
      <div className="mt-4 text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</span>
        {delta && (
          <span
            className={cx(
              'rounded-md px-1.5 py-0.5 text-xs font-medium',
              delta.pct === null ? 'bg-slate-100 text-slate-500' : delta.pct >= 0 ? 'bg-accent-50 text-accent-700' : 'bg-red-50 text-red-600',
            )}
          >
            {delta.pct === null ? delta.text : `${delta.pct >= 0 ? '▲' : '▼'} ${Math.abs(delta.pct)}%`}
          </span>
        )}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </>
  );
  const cls = 'block rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition';
  return href ? (
    <Link href={href} className={cx(cls, 'hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Быстрый переход в раздел. */
function Shortcut({ href, icon, title, text }: { href: string; icon: IconName; title: string; text: ReactNode }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-xs transition hover:border-brand-200 hover:shadow-md">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition group-hover:bg-brand-50 group-hover:text-brand-600">
        <Icon name={icon} duotone className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-900">{title}</span>
        <span className="block truncate text-xs text-slate-500">{text}</span>
      </span>
    </Link>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ forbidden?: string; days?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const days = PERIODS.find((d) => String(d) === sp.days) ?? 30;
  const [content, templates, home, leads, search, recent, media, services, mailing] = await Promise.all([
    can(user, 'content') ? safe(serviceJson<ContentStats>('content', 'stats', { user })) : null,
    can(user, 'content') ? safe(serviceJson<{ template: string; count: number }[]>('content', 'pages/templates', { user })) : null,
    can(user, 'content') ? safe(serviceJson<{ items: { id: number }[] }>('content', 'pages?template=home&limit=1', { user })) : null,
    can(user, 'leads') ? safe(serviceJson<LeadStats>('leads', `leads/stats?days=${days}`, { user })) : null,
    can(user, 'search') ? safe(serviceJson<{ documents: number; updatedAt: string | null }>('search', 'stats', { user })) : null,
    can(user, 'audit') ? safe(db().auditEntry.findMany({ orderBy: { at: 'desc' }, take: 8 })) : null,
    can(user, 'media')
      ? safe(
          db().$queryRaw<MediaFolder[]>`
            select split_part(key, '/', 1) as folder, count(*)::int as files, coalesce(sum(size), 0)::bigint as bytes
            from content.assets where key !~ '\.(png|jpe?g)\.webp$'
            group by 1 order by 3 desc`,
        )
      : null,
    Promise.all(SERVICES.map(async (s) => ({ ...s, ...(await health(s.id)) }))),
    null as MailingSummary | null, // рассылок на этом сайте нет
  ]);
  const count = (...t: string[]) => t.reduce((s, x) => s + (templates?.find((r) => r.template === x)?.count ?? 0), 0);
  const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });

  // заявки по дням — с нулями в днях без заявок
  const byDay = new Map(leads?.byDay.map((d) => [d.day, d.count]) ?? []);
  const series = Array.from({ length: days }, (_, i) => {
    const key = dayKey(new Date(Date.now() - (days - 1 - i) * 24 * 3600 * 1000));
    const value = byDay.get(key) ?? 0;
    const [, m, d] = key.split('-');
    const title = `${new Date(`${key}T12:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}: ${value} ${plural(value, 'заявка', 'заявки', 'заявок')}`;
    return { label: `${d}.${m}`, value, title };
  });
  const delta = leads
    ? leads.previous > 0
      ? { pct: Math.round(((leads.period - leads.previous) / leads.previous) * 100), text: '' }
      : { pct: null, text: leads.period ? 'новые' : '—' }
    : null;
  const sum = (r: Record<string, number> | undefined) => Object.values(r ?? {}).reduce((s, n) => s + n, 0);
  const b24Total = sum(leads?.b24) - (leads?.b24.skipped ?? 0);
  const delivered = leads ? (leads.byStatus.delivered ?? 0) : 0;
  const undelivered = leads ? (leads.byStatus.failed ?? 0) + (leads.byStatus.partial ?? 0) : 0;
  const spam = leads?.rejects.reduce((s, r) => s + r.count, 0) ?? 0;
  const mediaFiles = media?.reduce((s, f) => s + f.files, 0) ?? 0;
  const mediaBytes = media?.reduce((s, f) => s + Number(f.bytes), 0) ?? 0;
  const siteParts = [
    { label: 'Товары', value: count('product') },
    { label: 'Запчасти', value: count('spare') },
    { label: 'Категории и разделы', value: count('section', 'category', 'spare-category', 'catalog-root') },
    { label: 'Статьи Практикума', value: content?.documents ?? 0 },
    { label: 'Новости', value: count('news') },
    { label: 'Проекты', value: count('project') },
    { label: 'Услуги и решения', value: count('service', 'solution') },
  ].filter((p) => p.value > 0);
  const otherPages = Math.max(0, (content?.pages ?? 0) - siteParts.filter((p) => p.label !== 'Статьи Практикума').reduce((s, p) => s + p.value, 0));
  if (otherPages) siteParts.push({ label: 'Остальные страницы', value: otherPages });
  const typedShare = content && content.blocks ? Math.round(((content.blocks - content.htmlBlocks) / content.blocks) * 100) : 0;
  const allUp = services.every((s) => s.ok);

  // переходы из рассылок по дням за 30 дней — с нулями
  const mailClicks = new Map(mailing?.clicksByDay.map((d) => [d.day, d.clicks]) ?? []);
  const mailSeries = Array.from({ length: 30 }, (_, i) => {
    const key = dayKey(new Date(Date.now() - (29 - i) * 24 * 3600 * 1000));
    const value = mailClicks.get(key) ?? 0;
    const [, m, d] = key.split('-');
    return { label: `${d}.${m}`, value, title: `${d}.${m}: ${value} ${plural(value, 'переход', 'перехода', 'переходов')} из писем` };
  });

  return (
    <div className="space-y-6">
      {/* приветствие и действия */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 px-6 py-6 text-white shadow-sm sm:px-8">
        <div className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-accent-500/20 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm text-brand-100 first-letter:uppercase">{today}</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Здравствуйте, {user.name.split(' ')[0]}</h1>
            <p className="mt-1 text-sm text-brand-100">
              {leads ? (
                <>
                  Сегодня {fmt(leads.today)} {plural(leads.today, 'заявка', 'заявки', 'заявок')}, за {days} {plural(days, 'день', 'дня', 'дней')} — {fmt(leads.period)}.{' '}
                </>
              ) : null}
              {allUp ? 'Все сервисы сайта работают.' : 'Часть сервисов недоступна — см. «Состояние сайта».'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {can(user, 'content') && (
              <Link href="/pages/new" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-brand-800 shadow-sm transition hover:bg-brand-50">
                <Icon name="plus" className="h-4 w-4" />
                Новая страница
              </Link>
            )}
            <a
              href={env().PUBLIC_SITE_URL}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Открыть сайт
              <Icon name="external" className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      {sp.forbidden && <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">У вас нет доступа к этому разделу.</p>}

      {/* показатели */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {leads && (
          <>
            <Kpi
              icon="inbox"
              label={`Заявки за ${days} ${plural(days, 'день', 'дня', 'дней')}`}
              value={fmt(leads.period)}
              delta={delta}
              sub={`прошлые ${days} ${plural(days, 'день', 'дня', 'дней')}: ${fmt(leads.previous)} · всего ${fmt(leads.total)}`}
              spark={<Sparkline id="spark-leads" values={series.map((s) => s.value)} />}
              href="/leads"
            />
            <Kpi icon="today" label="Сегодня" value={fmt(leads.today)} sub={`${plural(leads.today, 'заявка', 'заявки', 'заявок')} с начала дня (Екатеринбург)`} tone="accent" href="/leads" />
            <Kpi
              icon={undelivered ? 'shield' : 'check'}
              label="Доставка в CRM и почту"
              value={undelivered ? fmt(undelivered) : delivered ? '100%' : '—'}
              sub={undelivered ? `${plural(undelivered, 'заявка не доставлена', 'заявки не доставлены', 'заявок не доставлено')} — повторите из карточки` : 'все заявки доставлены'}
              tone={undelivered ? 'red' : 'accent'}
              href={undelivered ? '/leads?status=failed' : '/leads'}
            />
          </>
        )}
        {content && (
          <Kpi
            icon="pages"
            label="Страниц на сайте"
            value={fmt(content.pages + content.documents)}
            sub={`${fmt(content.drafts)} ${plural(content.drafts, 'черновик', 'черновика', 'черновиков')} · ${fmt(content.editedInAdmin)} изменено в админке`}
            tone="slate"
            href="/pages"
          />
        )}
      </div>

      {leads && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Panel
            className="xl:col-span-2"
            title="Заявки по дням"
            action={
              <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
                {PERIODS.map((p) => (
                  <Link
                    key={p}
                    href={p === 30 ? '/' : `/?days=${p}`}
                    className={cx('rounded-md px-2.5 py-1 font-medium transition', p === days ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800')}
                  >
                    {p} дн.
                  </Link>
                ))}
              </div>
            }
          >
            {leads.period ? <AreaChart id="chart-leads" points={series} /> : <p className="py-16 text-center text-sm text-slate-400">За этот период заявок не было.</p>}
          </Panel>
          <Panel title="С каких форм приходят" action={<More href="/leads">Все заявки</More>}>
            <Donut slices={leads.bySource.map((s) => ({ label: s.name, value: s.count }))} caption={plural(leads.period, 'заявка', 'заявки', 'заявок')} />
          </Panel>
        </div>
      )}

      {leads && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Страницы, с которых пишут">
            <BarList
              items={leads.byPage.map((p) => ({ key: p.page, label: <span className="font-mono text-xs">{p.page}</span>, value: p.count }))}
              empty="За период заявок не было"
            />
          </Panel>
          <Panel title="Доставка и защита от спама">
            <div className="space-y-5">
              <div>
                <div className="mb-2 text-xs font-medium text-slate-500">Письмо менеджерам</div>
                <StackBar
                  parts={[
                    { label: 'отправлено', value: leads.mail.sent ?? 0, color: PALETTE[1] },
                    { label: 'в очереди', value: leads.mail.pending ?? 0, color: PALETTE[2] },
                    { label: 'ошибка', value: leads.mail.failed ?? 0, color: PALETTE[5] },
                  ]}
                />
              </div>
              <div>
                <div className="mb-2 text-xs font-medium text-slate-500">Лид в Битрикс24 {b24Total === 0 && '— не подключён'}</div>
                <StackBar
                  parts={[
                    { label: 'создан', value: leads.b24.sent ?? 0, color: PALETTE[0] },
                    { label: 'в очереди', value: leads.b24.pending ?? 0, color: PALETTE[2] },
                    { label: 'ошибка', value: leads.b24.failed ?? 0, color: PALETTE[5] },
                    { label: 'без CRM', value: leads.b24.skipped ?? 0, color: PALETTE[7] },
                  ]}
                />
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-xs">
                  <Icon name="shield" duotone className="h-5 w-5" />
                </span>
                <div className="text-sm">
                  <div className="font-medium text-slate-900">
                    Отсеяно спама: {fmt(spam)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {leads.rejects.length
                      ? leads.rejects.map((r) => `${r.reason === 'honeypot' ? 'ловушка для ботов' : r.reason === 'timecheck' ? 'слишком быстрая отправка' : r.reason} — ${r.count}`).join(' · ')
                      : 'боты не попадались'}
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {mailing && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Panel className="xl:col-span-2" title="Переходы из email-рассылок за 30 дней" action={<More href="/mailing">Рассылки</More>}>
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ['Отправлено писем', fmt(mailing.last30.sent)],
                ['Открыли', `${pct(mailing.last30.opened, mailing.last30.sent)}%`],
                ['Перешли на сайт', `${pct(mailing.last30.clicked, mailing.last30.sent)}%`],
                ['Переходов', fmt(mailing.last30.clicks)],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs font-medium text-slate-500">{label}</div>
                  <div className="text-xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</div>
                </div>
              ))}
            </div>
            {mailing.last30.clicks ? (
              <AreaChart id="chart-mail-clicks" points={mailSeries} height={200} />
            ) : (
              <p className="py-10 text-center text-sm text-slate-400">За 30 дней переходов из писем не было.</p>
            )}
          </Panel>
          <Panel title="Последние рассылки" action={<More href="/mailing">Все</More>}>
            {mailing.campaigns.length ? (
              <ul className="space-y-3">
                {mailing.campaigns.map((c) => {
                  const [label, tone] = CAMPAIGN_STATUS[c.status] ?? [c.status, 'gray'];
                  return (
                    <li key={c.id}>
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/mailing/${c.id}`} className="truncate text-sm font-medium text-slate-800 hover:text-brand-600">
                          {c.name}
                        </Link>
                        <Badge tone={tone}>{label}</Badge>
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDate(c.startedAt)} · {fmt(c.stats.sent)} {plural(c.stats.sent, 'письмо', 'письма', 'писем')} · открыли {pct(c.stats.opened, c.stats.sent)}% · перешли{' '}
                        {pct(c.stats.clicked, c.stats.sent)}%{c.transport === 'log' && ' · тест'}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                Рассылок ещё не было. Адресов для рассылок: {fmt(mailing.contacts.active)}.
              </p>
            )}
          </Panel>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {content && (
          <Panel title="Что на сайте" action={<More href="/pages">Все страницы</More>}>
            <BarList items={siteParts.map((p) => ({ key: p.label, label: p.label, value: p.value }))} color={PALETTE[3]} />
          </Panel>
        )}
        {media && (
          <Panel title="Медиатека" action={<More href="/media">Открыть</More>}>
            <div className="mb-4 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{fmt(mediaFiles)}</span>
              <span className="text-sm text-slate-500">
                {plural(mediaFiles, 'файл', 'файла', 'файлов')} · {formatBytes(mediaBytes)}
              </span>
            </div>
            <BarList
              items={media.map((f) => ({
                key: f.folder,
                label: (
                  <>
                    <span className="font-mono text-xs">/{f.folder}/</span> <span className="text-xs text-slate-400">{formatBytes(Number(f.bytes))}</span>
                  </>
                ),
                value: f.files,
              }))}
              color={PALETTE[4]}
            />
          </Panel>
        )}
        <Panel title="Состояние сайта">
          <ul className="space-y-2.5">
            {services.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2.5">
                  <span className={cx('relative flex h-2.5 w-2.5')}>
                    {s.ok && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-500 opacity-40" />}
                    <span className={cx('relative inline-flex h-2.5 w-2.5 rounded-full', s.ok ? 'bg-accent-500' : 'bg-red-500')} />
                  </span>
                  <span className="text-slate-700">{s.label}</span>
                </span>
                <span className={cx('text-xs tabular-nums', s.ok ? 'text-slate-400' : 'font-medium text-red-600')}>{s.ok ? `${s.ms} мс` : 'не отвечает'}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
            {search && (
              <div>
                <div className="text-lg font-semibold text-slate-900 tabular-nums">{fmt(search.documents)}</div>
                страниц в поиске
              </div>
            )}
            {content && (
              <div>
                <div className="text-lg font-semibold text-slate-900 tabular-nums">{fmt(content.redirects)}</div>
                редиректов
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Быстрый переход</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {can(user, 'content') && (
              <>
                <Shortcut href="/catalog" icon="catalog" title="Каталог продукции" text={`${fmt(count('product'))} товаров · ${fmt(count('spare'))} запчастей`} />
                {home?.items[0] && <Shortcut href={`/pages/${home.items[0].id}`} icon="home" title="Главная страница" text="Обложка, направления, кейсы" />}
                <Shortcut href="/pages?group=news" icon="news" title="Новости" text={`${fmt(count('news'))} ${plural(count('news'), 'новость', 'новости', 'новостей')}`} />
                <Shortcut href="/pages?group=projects" icon="projects" title="Проекты" text={`${fmt(count('project'))} ${plural(count('project'), 'проект', 'проекта', 'проектов')}`} />
                <Shortcut href="/stock" icon="stock" title="Наличие на складе" text={`${fmt(content?.stock ?? 0)} позиций`} />
                <Shortcut href="/settings" icon="settings" title="Шапка, меню, контакты" text="Телефоны, адреса, пункты меню" />
              </>
            )}
          </div>
        </div>
        {recent && (
          <Panel className="xl:col-span-2" title="Последние изменения" action={<More href="/audit">Журнал</More>}>
            <ol className="relative ml-1 space-y-0 border-l border-slate-200">
              {recent.map((r) => {
                const tone = actionTone(r.action);
                return (
                  <li key={r.id} className="relative flex items-start justify-between gap-4 py-2.5 pl-5">
                    <span
                      className={cx(
                        'absolute top-4 -left-[5px] h-2.5 w-2.5 rounded-full ring-4 ring-white',
                        tone === 'red' ? 'bg-red-500' : tone === 'gray' ? 'bg-slate-300' : 'bg-brand-500',
                      )}
                    />
                    <span className="min-w-0 text-sm text-slate-700">{describeAction(r)}</span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {r.userEmail?.split('@')[0] ?? '—'} · {formatDate(r.at)}
                    </span>
                  </li>
                );
              })}
              {!recent.length && <li className="py-2 pl-5 text-sm text-slate-500">Пока пусто.</li>}
            </ol>
          </Panel>
        )}
      </div>

      {content && (
        <details className="rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-slate-600">Техническая сводка (для разработчика)</summary>
          <div className="space-y-6 border-t border-slate-100 p-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Страниц" value={content.pages} hint={`+ ${content.documents} статей Практикума · черновиков: ${content.drafts}`} />
              <Stat label="Блоки с полями" value={`${typedShare}%`} hint={`${content.blocks - content.htmlBlocks} из ${content.blocks}, остальные — секции HTML`} />
              {search && <Stat label="Страниц в поиске" value={search.documents} hint={`обновлено ${formatDate(search.updatedAt)}`} />}
              <Stat label="Редиректов" value={content.redirects} />
            </div>
            <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(content.byType)
                .sort((a, b) => b[1] - a[1])
                .map(([type, n]) => (
                  <li key={type} className="flex justify-between gap-3">
                    <span className="truncate text-slate-600">{type === 'html' ? 'Секции HTML' : (BLOCK_LABELS[type as Block['type']] ?? type)}</span>
                    <Badge>{n}</Badge>
                  </li>
                ))}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
}
