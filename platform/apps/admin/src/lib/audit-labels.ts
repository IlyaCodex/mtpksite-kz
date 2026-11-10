/**
 * Журнал действий по-русски: «Изменена страница „Пусконаладка…“» вместо
 * кода content.put и адреса /pages/941. Коды — «сервис.метод» запросов
 * админки (api/v1/[service]) и события входа и пользователей.
 */
type Entry = { action: string; target: string | null; details: unknown };

const plain = (s: unknown) =>
  String(s ?? '')
    .split('|')[0]
    .replace(/&nbsp;/g, ' ')
    .trim();

export function describeAction({ action, target, details }: Entry): string {
  const d = (details && typeof details === 'object' ? details : {}) as Record<string, unknown>;
  const t = target ?? '';
  const title = plain(d.title) || plain(d.path);
  const file = t.replace(/^\/objects\//, '');
  const verb = action.split('.').pop();
  const done = verb === 'post' ? 'Добавлен' : verb === 'delete' ? 'Удалён' : 'Изменён';
  switch (true) {
    case action === 'login':
      return 'Вход в админку';
    case action === 'login.failed':
      return `Неудачная попытка входа: ${t}`;
    case action === 'logout':
      return 'Выход из админки';
    case action === 'login.2fa_failed':
      return `Неверный код 2FA при входе: ${t}`;
    case action === '2fa.enable':
      return 'Включена двухфакторная защита';
    case action === '2fa.disable':
      return 'Выключена двухфакторная защита';
    case action === '2fa.codes':
      return 'Новые резервные коды 2FA';
    case action === '2fa.recovery_used':
      return `Вход по резервному коду 2FA (осталось ${Number(d.left ?? 0)})`;
    case action === '2fa.reset':
      return `Сброшена 2FA пользователя ${t}`;
    case action === 'user.create':
      return `Добавлен пользователь ${t}`;
    case action === 'user.update':
      return `Изменён пользователь ${t}`;
    case action === 'user.delete':
      return `Удалён пользователь ${t}`;
    case action.startsWith('content.') && t.startsWith('/pages'):
      return `${verb === 'post' ? 'Создана' : verb === 'delete' ? 'Удалена' : 'Изменена'} страница${title ? ` «${title}»` : ''}`;
    case action.startsWith('content.') && t.startsWith('/catalog/reorder'):
      return 'Изменён порядок карточек каталога';
    case action.startsWith('content.') && /^\/catalog\/(categories|subcategories|products)/.test(t): {
      const kind = t.split('/')[2];
      const [noun, f] = kind === 'categories' ? ['категория', true] : kind === 'subcategories' ? ['подкатегория', true] : ['товар', false];
      const name = plain(d.name);
      const verbText = verb === 'post' ? (f ? 'Добавлена' : 'Добавлен') : verb === 'delete' ? (f ? 'Удалена' : 'Удалён') : f ? 'Изменена' : 'Изменён';
      return `${verbText} ${noun} каталога${name ? ` «${name}»` : ''}`;
    }
    case action.startsWith('content.') && t === '/settings':
      return 'Изменены шапка, меню и контакты';
    case action.startsWith('content.') && t.startsWith('/redirects'):
      return `${done} редирект${d.from ? ` ${String(d.from)} → ${String(d.to ?? '')}` : ''}`;
    case action.startsWith('content.') && t === '/stock':
      return 'Обновлено наличие на складе';
    case action.startsWith('content.') && t === '/photo-reports':
      return 'Обновлены фотоотчёты';
    case action.startsWith('content.') && t.startsWith('/cache'):
      return 'Обновлён кеш сайта';
    case action.startsWith('media.') && t.startsWith('/objects'):
      return verb === 'delete' ? `Удалён файл ${file}` : `Загружен файл ${file}`;
    case action.startsWith('leads.') && t.endsWith('/resend'):
      return `Повторная отправка заявки №${t.split('/')[2] ?? ''}`;
    case action.startsWith('search.'):
      return 'Пересобран поиск по сайту';
    case action.startsWith('mailing.'):
      return describeMailing(verb ?? '', t, d);
    default:
      return `${action} ${t}`.trim();
  }
}

/** Действия раздела «Email-рассылки»: базы, адреса, рассылки. */
function describeMailing(verb: string, t: string, d: Record<string, unknown>): string {
  const name = plain(d.name) ? ` «${plain(d.name)}»` : '';
  const [, kind, , step] = t.split('/');
  if (kind === 'lists') {
    const steps: Record<string, string> = {
      'import-file': 'Загружены адреса из файла в базу рассылок',
      'import-text': 'Добавлены адреса списком в базу рассылок',
      'import-leads': 'Добавлены адреса из заявок сайта в базу рассылок',
      'import-crm': 'Запущена загрузка адресов из CRM в базу рассылок',
      remove: 'Убраны адреса из базы рассылок',
    };
    if (step) return steps[step] ?? `Изменена база рассылок`;
    return `${verb === 'post' ? 'Создана' : verb === 'delete' ? 'Удалена' : 'Изменена'} база рассылок${name}`;
  }
  if (kind === 'contacts') return d.status === 'active' ? 'Адрес возвращён в рассылки' : 'Адрес отписан от рассылок';
  if (kind === 'campaigns') {
    const steps: Record<string, string> = {
      duplicate: 'Сделана копия рассылки',
      test: 'Отправлено тестовое письмо рассылки',
      schedule: 'Запущена рассылка',
      unschedule: 'Рассылка снята с расписания',
      pause: 'Рассылка поставлена на паузу',
      resume: 'Рассылка продолжена',
      cancel: 'Рассылка остановлена',
    };
    if (step) return steps[step] ?? 'Изменена рассылка';
    return `${verb === 'post' ? 'Создана' : verb === 'delete' ? 'Удалена' : 'Изменена'} рассылка${name}`;
  }
  return `Рассылки: ${t}`;
}

/** Цвет метки действия: удаления, неудачные входы и снятие 2FA — красным. */
export const actionTone = (action: string) =>
  action.endsWith('.delete') || ['login.failed', 'login.2fa_failed', '2fa.disable', '2fa.reset'].includes(action)
    ? 'red'
    : action.startsWith('login') || action === 'logout'
      ? 'gray'
      : 'blue';
