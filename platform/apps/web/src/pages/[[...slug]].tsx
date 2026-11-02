import type { GetStaticPaths, GetStaticProps } from 'next';
import { heroPreload } from '@mtpk/content-kit/hero-css';
import { localizeJsonLd, splitLocalePath, translateText } from '@mtpk/content-kit/i18n';
import { activeNavFor } from '@mtpk/content-kit/page-meta';
import { activeHoliday, nextHolidayChange, type Block } from '@mtpk/content-model';
import { Blocks, buildRenderContext, holidayImageHints, preloadHints } from '@mtpk/ui';
import { CookieConsent } from '@/components/CookieConsent';
import { Viewport } from '@/components/Viewport';
import { Drawer } from '@/components/layout/Drawer';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { getDictionary, getHolidays, getPage, getSettings, getSiteData } from '@/lib/content';
import { heroImage } from '@/lib/hero';
import { legacyScripts, pageModules, type SitePageProps } from '@/lib/page-props';
import { pageOgImage } from '@/lib/seo';
import { SITE, slugToPath } from '@/lib/site';

/** Страница уходит в браузер чистым HTML: без React-рантайма и без копии данных. */
export const config = { unstable_runtimeJS: false };

// Страницы генерируются при первом запросе и кешируются (ISR); контент-сервис
// сообщает об изменениях через /api/revalidate. Час — страховка.
export const getStaticPaths: GetStaticPaths = async () => ({ paths: [], fallback: 'blocking' });

export const getStaticProps: GetStaticProps<SitePageProps> = async ({ params }) => {
  // адрес — /язык/путь/: содержимое в базе одно, по пути без языка (адреса без языка уводит на /ru/ src/proxy.ts)
  const { locale, path } = splitLocalePath(slugToPath(params?.slug as string[] | undefined));
  if (!locale) return { notFound: true, revalidate: 60 };
  const home = path === '/';
  const [page, settings, site, holidays, dict] = await Promise.all([getPage(path), getSettings(), getSiteData(), home ? getHolidays() : null, getDictionary(locale)]);
  if (!page || page.kind !== 'page') return { notFound: true, revalidate: 60 };
  const blocks = page.blocks as Block[];
  // главная в дни праздника — праздничная обложка (раздел «Праздники»): баннер предзагружается вместо фото обложки
  const now = Date.now();
  const holiday = home && blocks.some((b) => b.type === 'homeHero') ? activeHoliday(holidays, now) : null;
  // фото обложки (фон из CSS) — предзагрузка теми же адресами, что выберет CSS: узким экранам копия 828 px (hero-css.ts)
  const hero = holiday ? null : await heroImage(blocks, page.cssTemplates, page.externalStyles);
  const preload = holiday ? holidayImageHints(holiday.image) : !hero && page.preloadImage ? preloadHints(page.preloadImage, blocks) : null;
  // перегенерировать к ближайшей смене праздника (основной сигнал — от контент-сервиса в ту же минуту)
  const change = home ? nextHolidayChange(holidays, now) : null;
  const revalidate = change ? Math.min(3600, Math.max(15, Math.ceil((change - now) / 1000) + 5)) : 3600;
  return {
    props: {
      locale,
      path,
      blocks,
      settings,
      site,
      activeNav: activeNavFor(path) ?? null,
      home,
      holiday,
      head: {
        locale,
        path: page.path,
        title: translateText(page.title, dict),
        description: page.description && translateText(page.description, dict),
        noindex: page.noindex,
        preloadImage: hero ? null : (preload?.href ?? page.preloadImage),
        preloadHero: hero ? heroPreload(hero) : null,
        // превью ссылки — фото товара, статьи или обложки; у главной — общая картинка сайта
        ogImage: home ? null : pageOgImage(page.jsonLd, hero),
        preloadSrcSet: preload?.srcSet ?? null,
        preloadSizes: preload?.sizes ?? null,
        jsonLd: page.jsonLd.map((json) => localizeJsonLd(json, locale, dict, SITE)),
        cssTemplates: page.cssTemplates,
        externalStyles: page.externalStyles,
        inlineStyles: page.inlineStyles,
      },
      modules: pageModules(blocks, holiday),
      legacy: legacyScripts(page.features),
    },
    revalidate,
  };
};

/** Любая страница сайта: шапка, блоки страницы (React-компоненты @mtpk/ui), подвал. */
export default function SitePage({ path, blocks, settings, site, activeNav, holiday }: SitePageProps) {
  return (
    <>
      <Viewport />
      <Header settings={settings} activeNav={activeNav ?? undefined} />
      <main>
        <Blocks blocks={blocks} ctx={buildRenderContext(path, blocks, site, holiday)} />
      </main>
      <Footer settings={settings} />
      <Drawer settings={settings} />
      <CookieConsent />
    </>
  );
}
