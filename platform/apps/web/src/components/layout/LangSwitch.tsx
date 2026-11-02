import type { ReactNode } from 'react';
import { LANG_CODE, type Locale } from '@mtpk/content-kit/i18n';

/** Флаги — рисунками: эмодзи флагов в Windows не отображаются. */
const FLAGS: Record<Locale, ReactNode> = {
  kz: (
    <svg viewBox="0 0 24 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect fill="#00AFCA" height="16" rx="2" width="24" />
      <circle cx="12" cy="7" fill="#FFD100" r="3.1" />
      <g stroke="#FFD100" strokeLinecap="round" strokeWidth="0.7">
        <path d="M12 2.4v1.1M12 10.5v1.1M6.8 7h1.1M16.1 7h1.1M8.3 3.3l.8.8M14.9 9.9l.8.8M15.7 3.3l-.8.8M9.1 9.9l-.8.8" />
      </g>
      <path d="M11 12.5c.5.5 1.5.5 2 0" fill="none" stroke="#FFD100" strokeWidth="0.8" />
      <rect fill="#FFD100" height="12" opacity="0.9" width="1.4" x="1.6" y="2" />
    </svg>
  ),
  ru: (
    <svg viewBox="0 0 24 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect fill="#fff" height="5.34" width="24" />
      <rect fill="#0039A6" height="5.34" width="24" y="5.34" />
      <rect fill="#D52B1E" height="5.34" width="24" y="10.66" />
    </svg>
  ),
  en: (
    <svg viewBox="0 0 24 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect fill="#012169" height="16" width="24" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#fff" strokeWidth="3.2" />
      <path d="M0 0l24 16M24 0L0 16" stroke="#C8102E" strokeWidth="1.8" />
      <rect fill="#fff" height="16" width="4.8" x="9.6" />
      <rect fill="#fff" height="4.8" width="24" y="5.6" />
      <rect fill="#C8102E" height="16" width="2.4" x="10.8" />
      <rect fill="#C8102E" height="2.4" width="24" y="6.8" />
    </svg>
  ),
};

/** Каждый язык называется на своём: подписи не переводятся. */
const LANGS: { locale: Locale; code: string; name: string }[] = [
  { locale: 'kz', code: 'ҚАЗ', name: 'Қазақша' },
  { locale: 'ru', code: 'РУС', name: 'Русский' },
  { locale: 'en', code: 'ENG', name: 'English' },
];

/** Переключатель языка: ссылки на эту же страницу на других языках. */
export function LangSwitch({ locale, path }: { locale: Locale; path: string }) {
  return (
    <div className="lang-switch" translate="no">
      {LANGS.map((l) => (
        <a
          key={l.locale}
          className={l.locale === locale ? 'lang-btn is-active' : 'lang-btn'}
          href={`/${l.locale}${path}`}
          hrefLang={LANG_CODE[l.locale]}
          aria-label={l.name}
          aria-current={l.locale === locale ? 'true' : undefined}
          title={l.name}
        >
          <span className="lang-flag">{FLAGS[l.locale]}</span>
          <span className="lang-code">{l.code}</span>
        </a>
      ))}
    </div>
  );
}
