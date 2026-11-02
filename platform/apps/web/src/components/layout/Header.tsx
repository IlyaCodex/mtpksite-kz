import { Fragment } from 'react';
import { DEFAULT_LOCALE, type Locale } from '@mtpk/content-kit/i18n';
import type { NavItem, SiteSettings } from '@mtpk/content-model';
import { ContactLink } from './ContactLink';
import { QuickCallForm } from '@mtpk/ui';
import { ClockIcon, MAIL_SVG, MaxLogo, MenuIcon, SearchIcon, TelegramLogo, ThemeIcons } from './icons';
import { LangSwitch } from './LangSwitch';
import { HEADER_LOGO, Logo } from './Logo';

/**
 * Шапка сайта — одна на все страницы: строка контактов и переключатель языка, логотип,
 * главное меню с мегаменю, поиск, переключатель светлой и тёмной темы, мобильное меню и
 * экспресс-звонок. Контакты и пункты меню — из настроек сайта (админка «Шапка, меню, контакты»).
 */
export function Header({ settings, activeNav, locale = DEFAULT_LOCALE, path = '/' }: { settings: SiteSettings; activeNav?: string; locale?: Locale; path?: string }) {
  const { contacts } = settings;
  return (
    // класс is-scrolled при прокрутке ставит клиентский модуль (header.ts)
    <div className="header-shell">
      <div className="header-top">
        <div className="container header-top__inner">
          {contacts.hours && (
            <>
              <span className="contact-hours" aria-label="Режим работы">
                <ClockIcon />
                {contacts.hours}
              </span>
              <span className="contact-sep" />
            </>
          )}
          {contacts.phones.map((phone) => (
            <Fragment key={phone.href}>
              <ContactLink
                href={phone.href}
                className={phone.local ? 'contact-link contact-link--phone contact-link--phone-local' : 'contact-link contact-link--phone'}
                aria-label={phone.label}
                text={phone.text}
              />
              <span className="contact-sep" />
            </Fragment>
          ))}
          <ContactLink href={`mailto:${contacts.email}`} className="contact-link" aria-label="Написать на email" icon={MAIL_SVG} text={contacts.email} />
          <span className="contact-sep" />
          {(contacts.telegram || contacts.max) && (
            <>
              <div className="messengers" aria-label="Связь в мессенджерах">
                {contacts.telegram && (
                  <a href={contacts.telegram} className="msg-icon" aria-label="Написать в Telegram" title="Telegram">
                    <TelegramLogo />
                  </a>
                )}
                {contacts.max && (
                  <a href={contacts.max} className="msg-icon" aria-label="Написать в MAX" title="MAX">
                    <MaxLogo id="maxGrad-header" size={240} />
                  </a>
                )}
              </div>
              <span className="contact-sep" />
            </>
          )}
          <LangSwitch locale={locale} path={path} />
        </div>
      </div>

      <header className="header">
        <div className="container header__inner">
          <a href="/" className="header__brand" aria-label="УралИндуктор — на главную">
            <Logo
              src={HEADER_LOGO}
              alt="УралИндуктор · производство и поставка оборудования для металлургии"
              width="184"
              height="48"
              fetchPriority="high"
              decoding="async"
            />
          </a>
          <nav className="nav" aria-label="Главная навигация">
            {settings.nav.map((item) => (
              <NavEntry key={item.key} item={item} active={item.key === activeNav} />
            ))}
          </nav>
          <div className="header__actions">
            <button className="icon-btn" aria-label="Поиск" data-search-open="">
              <SearchIcon />
            </button>
            {/* состояние (aria-pressed, подсказка) ставит client/theme.ts */}
            <button type="button" className="icon-btn theme-toggle" aria-label="Тёмная тема" aria-pressed="false" title="Тёмная тема" data-theme-toggle="">
              <ThemeIcons />
            </button>
            {/* меню (до 1024 px) — крайним справа: поиск, тема, меню; форма звонка на этих ширинах скрыта */}
            <button className="nav-toggle" aria-label="Открыть меню" aria-expanded="false" data-nav-toggle="">
              <span className="nav-toggle__bar" />
              <span className="nav-toggle__bar" />
              <span className="nav-toggle__bar" />
            </button>
            <QuickCallForm />
          </div>
        </div>
      </header>
    </div>
  );
}

/** Пункт главного меню; у «Каталога» и «Услуг» — выпадающее мегаменю. */
function NavEntry({ item, active }: { item: NavItem; active: boolean }) {
  const className = active ? 'nav__link is-active' : 'nav__link';
  if (!item.mega) {
    return (
      <div className="nav__item">
        <a href={item.href} className={className}>
          {item.label}
        </a>
      </div>
    );
  }
  const { feature, columns } = item.mega;
  return (
    <div className="nav__item">
      <a href={item.href} className={className}>
        {`${item.label} `}
        <span className="nav__chevron" />
      </a>
      <div className="megamenu">
        <div className="megamenu__inner">
          {feature && (
            <div className="megamenu__feature">
              <div>
                <div className="megamenu__feature-eyebrow">{feature.eyebrow}</div>
                <div className="megamenu__feature-title">{feature.title}</div>
                <p className="megamenu__feature-text">{feature.text}</p>
              </div>
              <a href={feature.link.href} className="megamenu__feature-link">
                {feature.link.label}
              </a>
            </div>
          )}
          {columns.map((col) => (
            <div className="megamenu__col" key={col.title}>
              <div className="megamenu__col-title">{col.title}</div>
              <ul className="megamenu__list">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <a className="megamenu__link" href={link.href}>
                      <span className="megamenu__link-icon">
                        <MenuIcon paths={link.icon} strokeWidth={1.7} />
                      </span>
                      <span className="megamenu__link-body">
                        <span className="megamenu__link-title">{link.title}</span>
                        <span className="megamenu__link-desc">{link.desc}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
