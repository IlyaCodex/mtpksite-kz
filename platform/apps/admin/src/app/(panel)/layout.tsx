import { Sidebar, type NavItem } from '@/components/Sidebar';
import { Toaster } from '@/components/toast';
import { can, requireUser, ROLE_LABELS, type Area } from '@/lib/auth';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/** Меню: разделы по смыслу — содержимое сайта, его настройки, заявки, управление доступом. */
const NAV: (NavItem & { area?: Area })[] = [
  { href: '/', label: 'Обзор', icon: 'home' },
  { href: '/catalog', label: 'Каталог продукции', icon: 'catalog', area: 'content', group: 'Сайт' },
  { href: '/pages', label: 'Все страницы', icon: 'pages', area: 'content', group: 'Сайт' },
  { href: '/translations', label: 'Переводы', icon: 'pages', area: 'content', group: 'Сайт' },
  { href: '/media', label: 'Медиатека', icon: 'media', area: 'media', group: 'Сайт' },
  { href: '/stock', label: 'Наличие на складе', icon: 'stock', area: 'content', group: 'Сайт' },
  { href: '/settings', label: 'Шапка, меню, контакты', icon: 'settings', area: 'content', group: 'Настройки сайта' },
  { href: '/holidays', label: 'Праздники', icon: 'gift', area: 'content', group: 'Настройки сайта' },
  { href: '/redirects', label: 'Редиректы', icon: 'redirects', area: 'content', group: 'Настройки сайта' },
  { href: '/leads', label: 'Заявки', icon: 'leads', area: 'leads', group: 'Продажи' },
  { href: '/users', label: 'Пользователи', icon: 'users', area: 'users', group: 'Администрирование' },
  { href: '/audit', label: 'Журнал действий', icon: 'audit', area: 'audit', group: 'Администрирование' },
];

/** Каркас админки: меню разделов по правам пользователя и область страницы. */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = NAV.filter((n) => !n.area || can(user, n.area)).map(({ area: _area, ...n }) => n);
  return (
    <div className="flex min-h-screen">
      <Sidebar items={items} user={{ name: user.name, email: user.email, roleLabel: ROLE_LABELS[user.role] }} siteUrl={env().PUBLIC_SITE_URL} />
      <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
      <Toaster />
    </div>
  );
}
