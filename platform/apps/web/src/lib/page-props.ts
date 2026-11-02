import type { Locale } from '@mtpk/content-kit/i18n';
import { walkBlocks, type ActiveHoliday, type Block, type SiteSettings } from '@mtpk/content-model';
import type { SiteDataDto } from '@mtpk/shared/contracts';
import type { HeadPage } from '@/components/SiteHead';
import { clientModuleUrl, type ClientModule } from './assets';
import { versioned } from './versions';

/**
 * Данные страницы для шаблона документа (_document): <head> и скрипты
 * в конце <body>. В браузер они не передаются — страница уходит чистым HTML.
 */
export interface DocumentProps {
  locale: Locale;
  head: HeadPage;
  home: boolean;
  /** клиентские модули страницы (адреса собранных файлов) */
  modules: string[];
  /** старые скрипты блоков «HTML как есть» */
  legacy: string[];
}

export interface SitePageProps extends DocumentProps {
  path: string;
  blocks: Block[];
  settings: SiteSettings;
  site: SiteDataDto;
  activeNav: string | null;
  /** праздник на главной (раздел «Праздники»): праздничный вид обложки */
  holiday: ActiveHoliday | null;
}

/** Какие клиентские модули нужны странице — по её блокам (и праздничному эффекту обложки главной). */
export function pageModules(blocks: Block[], holiday: ActiveHoliday | null = null): string[] {
  const need = new Set<ClientModule>(['site']);
  if (holiday && holiday.effect !== 'none') need.add('holiday-fx');
  for (const b of walkBlocks(blocks)) {
    if (b.type === 'productHero' && b.media.photos.length > 1) need.add('gallery');
    if (b.type === 'lightbox') need.add('lightbox');
    if (b.type === 'productSpec') need.add('spec-nav');
    // контентный блок раздела: подсветка пункта «Содержания»
    if (b.type === 'html' && b.html.includes('class="cdoc__nav"')) need.add('spec-nav');
    // запчасти: окно «Запросить цену / подбор» (карточка детали и списки) и фото на весь экран
    // (у транзисторных запчастей — только оно)
    if (b.type === 'html' && /id="(?:request|image)-dialog"/.test(b.html)) need.add('spare');
    if (b.type === 'catalogList') need.add('catalog-filter');
    if (b.type === 'carousel' && b.slides.length > 1) need.add('carousel');
    if (b.type === 'gallery' && b.zoom && b.photos.length) need.add('lightbox');
    if (b.type === 'stockShowcase') need.add('stock');
    if (b.type === 'stockList') {
      need.add('stock');
      need.add('lightbox');
    }
  }
  return [...need].map((m) => clientModuleUrl(m)).filter((u): u is string => Boolean(u));
}

/** Старые скрипты для блоков «HTML как есть» (решает контент-сервис по их разметке). */
export function legacyScripts(features: string[]): string[] {
  // версия в адресе — хеш файла (считает сборка): новый скрипт браузер возьмёт сам
  return features.map((name) => versioned(`/js/${name}.js`));
}
