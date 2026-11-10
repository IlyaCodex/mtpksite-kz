import { z } from 'zod';
import { text } from './fields.ts';

/**
 * Фотоотчёты с объектов: отгрузки, запуски, сервисные выезды — дата, регион,
 * описание, фото и видео. Ведутся в админке «Фотоотчёты»; на сайте их выводит
 * блок «Фотоотчёты» (photoReports): карточки, фильтр по годам, окно с фото и
 * видео. Хранятся отдельной настройкой (content.settings, ключ photo-reports).
 * Файлы — в медиатеке, папка img/otchety/<год>/<отчёт>/.
 */

export const PHOTO_REPORT_KINDS = {
  shipment: 'Отгрузка',
  launch: 'Запуск',
  service: 'Сервис',
  delivery: 'Доставка',
} as const;
export type PhotoReportKind = keyof typeof PHOTO_REPORT_KINDS;
const kindKeys = Object.keys(PHOTO_REPORT_KINDS) as [PhotoReportKind, ...PhotoReportKind[]];

export const photoReportPhoto = z.object({
  src: z.string().min(1).describe('Фото'),
  alt: z.string().default('').describe('Что на фото (alt)'),
});
export type PhotoReportPhoto = z.infer<typeof photoReportPhoto>;

export const photoReportVideo = z.object({
  src: z.string().min(1).describe('Видео (MP4)'),
  /** кадр-обложка до запуска */
  poster: z.string().default(''),
});
export type PhotoReportVideo = z.infer<typeof photoReportVideo>;

export const photoReport = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'Латиница, цифры и дефис'),
  hidden: z.boolean().default(false),
  kind: z.enum(kindKeys).default('shipment'),
  /** дата события: на сайте — месяц и год */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата — ГГГГ-ММ-ДД'),
  title: text('Заголовок').min(1, 'Нужен заголовок'),
  /** регион поставки — на плашке фото («Курганская область») */
  region: text('Регион').default(''),
  /** город — в окне отчёта после региона («г. Курган») */
  city: text('Город').default(''),
  /** описание простым текстом; абзацы — через пустую строку */
  text: text('Описание').default(''),
  photos: z.array(photoReportPhoto).default([]),
  videos: z.array(photoReportVideo).default([]),
});
export type PhotoReport = z.infer<typeof photoReport>;

export const photoReportSettings = z.object({
  items: z.array(photoReport),
});
export type PhotoReportSettings = z.infer<typeof photoReportSettings>;

export const DEFAULT_PHOTO_REPORTS: PhotoReportSettings = { items: [] };

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

/** «Май 2025» — дата отчёта на плашке и в окне. */
export function photoReportMonth(date: string): string {
  const [y, m] = date.split('-').map(Number);
  return MONTHS[m - 1] ? `${MONTHS[m - 1]} ${y}` : String(y || '');
}

/** «Курганская область, г. Курган» — место целиком (регион и город, что заполнено). */
export function photoReportPlace(r: Pick<PhotoReport, 'region' | 'city'>): string {
  return [r.region.trim(), r.city.trim()].filter(Boolean).join(', ');
}

/** Отчёты для сайта: без скрытых и без фото, новые сверху. */
export function sitePhotoReports(items: PhotoReport[]): PhotoReport[] {
  return items
    .filter((r) => !r.hidden && r.photos.length)
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
