import type { GetStaticProps } from 'next';
import { DEFAULT_LOCALE } from '@mtpk/content-kit/i18n';
import type { SiteSettings } from '@mtpk/content-model';
import { CookieConsent } from '@/components/CookieConsent';
import { Viewport } from '@/components/Viewport';
import { Drawer } from '@/components/layout/Drawer';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { getPage, getSettings } from '@/lib/content';
import { pageModules, type DocumentProps } from '@/lib/page-props';
import { NOT_FOUND_PAGE } from '@/lib/seo';

export const config = { unstable_runtimeJS: false };

type Props = DocumentProps & { settings: SiteSettings };

// Каркас страницы 404 — стили главной, без её LCP-картинки и разметки.
export const getStaticProps: GetStaticProps<Props> = async () => {
  const [home, settings] = await Promise.all([getPage('/').catch(() => null), getSettings()]);
  return {
    props: {
      settings,
      locale: DEFAULT_LOCALE,
      home: false,
      head: {
        ...NOT_FOUND_PAGE,
        locale: DEFAULT_LOCALE,
        preloadImage: null,
        jsonLd: [],
        cssTemplates: [],
        externalStyles: home?.externalStyles ?? [],
        inlineStyles: [],
      },
      modules: pageModules([]),
      legacy: [],
    },
    // сборка образа идёт без контент-сервиса (меню по умолчанию) — тогда перестроить по первому же запросу
    revalidate: home ? 3600 : 10,
  };
};

export default function NotFound({ settings }: Props) {
  return (
    <>
      <Viewport />
      <Header settings={settings} />
      <main>
        <section className="nf">
          <div className="container">
            <div className="nf__code">404</div>
            <h1 className="nf__title">{'Страница не\u00A0найдена'}</h1>
            <p className="nf__text">{'Возможно, адрес изменился или\u00A0страница была перемещена.'}</p>
            <div className="nf__actions">
              <a href="/" className="btn btn--primary">
                {'На\u00A0главную '}
                <span className="btn__arrow" aria-hidden="true">
                  →
                </span>
              </a>
              <button type="button" className="btn btn--secondary" data-search-open="">
                {'Поиск по\u00A0сайту'}
              </button>
            </div>
          </div>
        </section>
      </main>
      <Footer settings={settings} />
      <Drawer settings={settings} />
      <CookieConsent />
    </>
  );
}
