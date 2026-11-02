import type { CSSProperties } from 'react';
import Document, { Head, Html, Main, NextScript, type DocumentContext } from 'next/document';
import { buttonDesignHtml } from '@mtpk/content-kit/design';
import { DEFAULT_LOCALE, LANG_CODE, localizeHtml, splitLocalePath } from '@mtpk/content-kit/i18n';
import type { SiteSettings } from '@mtpk/content-model';
import { SiteHead } from '@/components/SiteHead';
import { SiteScripts } from '@/components/SiteScripts';
import { getDictionary } from '@/lib/content';
import type { DocumentProps } from '@/lib/page-props';

/**
 * Каркас HTML-документа. Страницы отдаются чистым HTML без клиентского
 * React (unstable_runtimeJS: false у страниц): в <head> — SEO и стили
 * в порядке каскада, в конце <body> — маленькие клиентские модули.
 * Данные для <head> страница передаёт пропсами (getStaticProps). Оформление
 * кнопок из настроек сайта — атрибутами и переменными на <html>.
 * Язык: готовый HTML страницы проходит словарь и получает адреса с приставкой
 * языка (content-kit/i18n.ts) — компонентам о языке знать не нужно.
 */
export default class SiteDocument extends Document {
  static override async getInitialProps(ctx: DocumentContext) {
    const initial = await Document.getInitialProps(ctx);
    const { locale } = splitLocalePath((ctx.asPath ?? '').split(/[?#]/)[0] ?? '');
    // страница «не найдена» одна на все адреса: её ссылки ведут на основной язык
    const current = locale ?? (ctx.pathname === '/404' ? DEFAULT_LOCALE : null);
    return current ? { ...initial, html: localizeHtml(initial.html, current, await getDictionary(current)) } : initial;
  }

  override render() {
    const props = this.props.__NEXT_DATA__.props?.pageProps as Partial<DocumentProps> | undefined;
    const ready = props?.head !== undefined;
    const design = buttonDesignHtml((props as { settings?: SiteSettings } | undefined)?.settings?.design);
    const locale = props?.locale ?? DEFAULT_LOCALE;
    return (
      <Html lang={LANG_CODE[locale]} data-locale={locale} {...design.attrs} style={Object.keys(design.vars).length ? (design.vars as CSSProperties) : undefined}>
        <Head>{ready && <SiteHead page={props.head!} home={props.home} modules={props.modules} />}</Head>
        <body>
          <Main />
          <NextScript />
          {ready && <SiteScripts modules={props.modules ?? []} legacy={props.legacy ?? []} />}
        </body>
      </Html>
    );
  }
}
