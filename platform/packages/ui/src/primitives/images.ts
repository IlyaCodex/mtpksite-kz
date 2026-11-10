/**
 * Адаптивные картинки: браузер сам выбирает подходящую ширину из srcset,
 * медиасервис отдаёт её в AVIF/WebP (адрес …?w=640). Только для своих
 * растровых картинок (/img/… png, jpg, webp); SVG и внешние — как есть.
 *
 * Модуль общий для сервера (разметка) и браузера (галерея, просмотр фото):
 * одинаковые srcset/sizes — один и тот же файл, без повторной загрузки.
 */
const LOCAL_RASTER = /^\/img\/[^?#]+\.(png|jpe?g|webp)(\?[^#]*)?$/i;

export const isResponsive = (src: string | null | undefined): src is string => Boolean(src && LOCAL_RASTER.test(src));

/** Адрес копии шириной w (параметры исходного адреса, например ?v=3, сохраняются). */
export function variantUrl(src: string, w: number): string {
  return `${src}${src.includes('?') ? '&' : '?'}w=${w}`;
}

/** Ширины копий для srcset (медиасервис умеет те же). */
export const WIDTHS = {
  thumb: [160, 320],
  card: [320, 480, 640, 960],
  content: [480, 640, 960, 1280, 1600],
  wide: [640, 960, 1280, 1600, 1920],
} as const;

interface Place {
  widths: readonly number[];
  /** сколько места картинка занимает на экране (атрибут sizes) — замерено на сайте */
  sizes: string;
}

/**
 * Места картинок — класс картинки или её обёртки. Только те, где ширину
 * картинки задают стили (width: 100% и т. п.): с srcset браузер считает
 * «естественный» размер по sizes, и картинка без заданной ширины поменяла
 * бы размер. Картинки в других местах выводятся как есть.
 */
export const PLACES: Record<string, Place> = {
  // карточка товара: главное фото и миниатюры
  'phero__main': { widths: WIDTHS.content, sizes: '(max-width: 940px) 100vw, (max-width: 1440px) 46vw, 662px' },
  'phero__thumb': { widths: WIDTHS.thumb, sizes: '(max-width: 940px) 18vw, 120px' },
  'product-photo': { widths: WIDTHS.content, sizes: '(max-width: 640px) 81vw, (max-width: 1440px) 41vw, 590px' },
  // карточки в сетках каталога
  'card-image': { widths: WIDTHS.card, sizes: '(max-width: 640px) 40vw, (max-width: 860px) 26vw, (max-width: 1440px) 22vw, 320px' },
  'pcard__cover': { widths: WIDTHS.card, sizes: '(max-width: 640px) 100vw, (max-width: 1060px) 46vw, (max-width: 1440px) 31vw, 441px' },
  'teaser-card__cover': { widths: WIDTHS.card, sizes: '(max-width: 640px) 100vw, (max-width: 1060px) 46vw, (max-width: 1440px) 31vw, 441px' },
  'cat-card__cover': { widths: WIDTHS.card, sizes: '(max-width: 1060px) 46vw, 390px' },
  // «Оборудование» на главной: 4 в ряд, 3 до 1280px, по 2 до 1024px и на телефоне
  'equip-card__cover': { widths: WIDTHS.card, sizes: '(max-width: 1024px) 46vw, (max-width: 1280px) 31vw, 300px' },
  'stock-type__cover': { widths: WIDTHS.card, sizes: '(max-width: 640px) 72vw, (max-width: 1024px) 40vw, 300px' },
  'pcard__photo': { widths: WIDTHS.thumb, sizes: '72px' },
  'care__photo': { widths: WIDTHS.content, sizes: '(max-width: 1024px) 92vw, 540px' },
  // линейки ЛВМ/ЛГМ: 4 в ряд, 3 до 1100px, 2 до 800px, одна на телефоне
  'catalog-lvm-card__cover': { widths: WIDTHS.card, sizes: '(max-width: 480px) 92vw, (max-width: 800px) 46vw, (max-width: 1100px) 31vw, (max-width: 1440px) 23vw, 330px' },
  'catalog-lgm-card__cover': { widths: WIDTHS.card, sizes: '(max-width: 480px) 92vw, (max-width: 800px) 46vw, (max-width: 1100px) 31vw, (max-width: 1440px) 23vw, 330px' },
  'muf-mod__cover': { widths: WIDTHS.card, sizes: '(max-width: 640px) 100vw, (max-width: 900px) 46vw, (max-width: 1440px) 30vw, 330px' },
  // проекты: плитки с фото на всю карточку (есть широкие — на две колонки), фон шапки, миниатюры на странице проекта
  'pr-photo': { widths: WIDTHS.card, sizes: '(max-width: 760px) 100vw, (max-width: 1100px) 50vw, (max-width: 1440px) 46vw, 660px' },
  'pr-hero__bg': { widths: WIDTHS.wide, sizes: '100vw' },
  // фотоотчёты: карточки (4 в ряд, 3 до 1100px, 2 до 760px, одна до 480px), кадр в окне и миниатюры под ним
  'report-card__img': { widths: WIDTHS.card, sizes: '(max-width: 480px) 92vw, (max-width: 760px) 46vw, (max-width: 1100px) 31vw, (max-width: 1440px) 23vw, 340px' },
  'report-modal__img': { widths: WIDTHS.wide, sizes: '(max-width: 900px) 100vw, 760px' },
  'report-modal__thumb': { widths: WIDTHS.thumb, sizes: '80px' },
  // праздничный баннер обложки главной (раздел «Праздники»)
  'hero__holiday-img': { widths: WIDTHS.wide, sizes: '100vw' },
  'ui-thumb': { widths: WIDTHS.thumb, sizes: '84px' },
  // «О компании»: фон шапки, фото-мозаика производства (большой кадр и малые)
  'oc-hero__bg': { widths: WIDTHS.wide, sizes: '100vw' },
  'oc-photo--main': { widths: WIDTHS.content, sizes: '(max-width: 760px) 100vw, (max-width: 1100px) 92vw, (max-width: 1440px) 48vw, 690px' },
  'oc-photo': { widths: WIDTHS.card, sizes: '(max-width: 760px) 100vw, (max-width: 1100px) 46vw, (max-width: 1440px) 23vw, 340px' },
  // «Контакты»: фото здания в шапке, портреты сотрудников (на телефоне — миниатюрой слева)
  'kt-hero__media': { widths: WIDTHS.content, sizes: '(max-width: 760px) 92vw, (max-width: 1440px) 44vw, 631px' },
  'kt-person__photo': { widths: WIDTHS.card, sizes: '(max-width: 600px) 96px, (max-width: 760px) 46vw, (max-width: 1100px) 30vw, (max-width: 1440px) 18vw, 262px' },
  'scard__cover': { widths: WIDTHS.card, sizes: '(max-width: 1060px) 46vw, (max-width: 1440px) 31vw, 443px' },
  'category-tile': { widths: WIDTHS.thumb, sizes: '140px' },
  // фото в статье новости
  'news-figure': { widths: WIDTHS.content, sizes: '(max-width: 880px) 96vw, 830px' },
  // во всю ширину экрана
  'section-divider__img': { widths: WIDTHS.wide, sizes: '100vw' },
  'upgrade__photo': { widths: WIDTHS.content, sizes: '(max-width: 1024px) 92vw, 600px' },
};

/** srcset и sizes картинки src в месте place; null — картинка не адаптивная или место неизвестно. */
export function responsive(src: string | null | undefined, place: string | null | undefined): { srcSet: string; sizes: string } | null {
  const p = place && Object.hasOwn(PLACES, place) ? PLACES[place] : undefined;
  if (!p || !isResponsive(src)) return null;
  return { srcSet: p.widths.map((w) => `${variantUrl(src, w)} ${w}w`).join(', '), sizes: p.sizes };
}

/** То же пропсами для <img> (пусто, если картинка не адаптивная). */
export function responsiveProps(src: string, place: string): { srcSet?: string; sizes?: string } {
  return responsive(src, place) ?? {};
}
