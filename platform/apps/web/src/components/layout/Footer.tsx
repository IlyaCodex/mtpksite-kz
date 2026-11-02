import type { SiteSettings } from '@mtpk/content-model';
import { ContactLink } from './ContactLink';
import { FOOTER_MAIL_SVG, MaxLogo, TelegramGlyph } from './icons';
import { Logo } from './Logo';

/** Подвал: логотип и контакты, колонки ссылок, реквизиты и документы. */
export function Footer({ settings }: { settings: SiteSettings }) {
  const { contacts, company, footer } = settings;
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          <div className="footer__brand-block">
            <a href="/" className="footer__brand">
              <Logo src="/brand/logo-footer-white.png" alt="УралИндуктор" width="252" height="72" loading="lazy" decoding="async" />
            </a>
            <p className="footer__brand-tagline">{company.tagline}</p>
            <div className="footer__contact">
              {contacts.phones.map((phone) => (
                <ContactLink key={phone.href} href={phone.href} className="footer__phone" text={phone.text} />
              ))}
              <ContactLink href={`mailto:${contacts.email}`} icon={FOOTER_MAIL_SVG} text={contacts.email} />
            </div>
            <div className="footer__social">
              {contacts.instagram && (
                <a href={contacts.instagram} aria-label="Instagram" target="_blank" rel="noopener">
                  <img src="/img/kz/social/instagram.svg" alt="" width="18" height="18" loading="lazy" decoding="async" />
                </a>
              )}
              {contacts.tiktok && (
                <a href={contacts.tiktok} aria-label="TikTok" target="_blank" rel="noopener">
                  <img src="/img/kz/social/tiktok.svg" alt="" width="18" height="18" loading="lazy" decoding="async" />
                </a>
              )}
              {contacts.telegram && (
                <a href={contacts.telegram} aria-label="Telegram">
                  <TelegramGlyph />
                </a>
              )}
              {contacts.max && (
                <a href={contacts.max} aria-label="MAX">
                  <MaxLogo id="maxGrad-footer" size={24} />
                </a>
              )}
            </div>
          </div>

          {footer.columns.map((col) => (
            <div className="footer__col" key={col.title}>
              <div className="footer__col-title">{col.title}</div>
              <ul>
                {col.links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="footer__bottom">
          <div className="footer__copyright">
            <div className="footer__copyright-name">{company.copyright}</div>
            <div className="footer__copyright-legal">{company.legal}</div>
          </div>
          <div className="footer__bottom-links">
            {footer.bottomLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
