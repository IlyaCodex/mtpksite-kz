import {
  PHOTO_REPORT_KINDS,
  PHOTO_REPORTS_REGION,
  photoReportMonth,
  photoReportPlace,
  photoReportRegions,
  photoReportsRegionFirst,
  type PhotoReport,
  type PhotoReportsBlock,
} from '@mtpk/content-model';
import type { RenderContext } from '../context.ts';
import { extra, Inline } from '../primitives/Html.tsx';
import { responsiveProps } from '../primitives/images.ts';

const ICON = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

const Camera = () => (
  <svg viewBox="0 0 24 24" {...ICON}>
    <circle cx="12" cy="13" r="3" />
    <path d="M9.8 21h4.4c3.1 0 4.7 0 5.8-.7.5-.3.9-.7 1.2-1.2.8-1.1.8-2.6.8-5.7s0-4.6-.8-5.7c-.3-.5-.7-.9-1.2-1.2-.7-.5-1.6-.6-3-.7-.7 0-1.2-.5-1.4-1.1C15.5 3.7 14.6 3 13.6 3h-3.2c-1 0-1.9.7-2.1 1.6-.1.6-.7 1.1-1.3 1.1-1.4.1-2.3.2-3 .7-.5.3-.9.7-1.2 1.2C2 8.8 2 10.3 2 13.4s0 4.6.8 5.7c.3.5.7.9 1.2 1.2 1.1.7 2.7.7 5.8.7z" />
  </svg>
);
const Play = () => (
  <svg viewBox="0 0 24 24" {...ICON}>
    <path d="M7 5.5v13l11-6.5z" />
  </svg>
);
const Calendar = () => (
  <svg viewBox="0 0 24 24" {...ICON}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);
const Pin = () => (
  <svg viewBox="0 0 24 24" {...ICON}>
    <path d="M12 21.5c-.4 0-.8-.2-1.1-.5C8.3 18.5 4.5 14.6 4.5 10a7.5 7.5 0 0 1 15 0c0 4.6-3.8 8.5-6.4 11-.3.3-.7.5-1.1.5z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
);
const Chevron = ({ dir }: { dir: -1 | 1 }) => (
  <svg viewBox="0 0 24 24" {...ICON} strokeWidth={2.2}>
    <path d={dir < 0 ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
  </svg>
);
const Close = () => (
  <svg viewBox="0 0 24 24" {...ICON} strokeWidth={2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/** Первые слова описания для карточки (полностью — в окне). */
function excerpt(text: string, max = 170): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, flat.lastIndexOf(' ', max)).replace(/[,.;:—-]+$/, '')}…`;
}

/** Данные окна для клиентского модуля (photo-reports.ts): JSON без «</script» внутри. */
function modalData(items: PhotoReport[]): string {
  const data = items.map((r) => ({
    id: r.id,
    kind: PHOTO_REPORT_KINDS[r.kind],
    date: photoReportMonth(r.date),
    place: photoReportPlace(r),
    title: r.title,
    text: r.text,
    photos: r.photos.map((p) => ({ src: p.src, alt: p.alt })),
    videos: r.videos.map((v) => ({ src: v.src, poster: v.poster })),
  }));
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * Фотоотчёты с объектов: карточки (фото, на нём месяц и регион, вид работ,
 * заголовок, начало описания), сначала pageSize штук, следующие — при прокрутке
 * до конца списка; кнопки годов и выбор региона: отчёты выбранного региона
 * (сразу — block.region) первыми, затем остальные. Щелчок по карточке — окно
 * <dialog> с каруселью фото и видео, описанием, датой и местом. Окно, фильтры и
 * подгрузку оживляет клиентский модуль photo-reports; без скрипта видны первые
 * карточки. joined — без своего заголовка: черта и «По годам» с кнопками годов
 * справа; выбор региона скрипт ставит справа от заголовка раздела выше.
 */
export function PhotoReports({ block, ctx }: { block: PhotoReportsBlock; ctx: RenderContext }) {
  const all = block.items ?? [];
  if (!all.length) return null;
  const regions = photoReportRegions(all);
  // поля нет у блоков, сохранённых раньше; регион без отчётов не выбирается — тогда все по дате
  const wanted = block.region ?? PHOTO_REPORTS_REGION;
  const region = regions.some((g) => g.label === wanted) ? wanted : '';
  const items = photoReportsRegionFirst(all, region);
  const order = new Map(all.map((r, i) => [r.id, i]));
  const id = block.attrs?.id ?? 'otchety';
  const years = [...new Set(items.map((r) => r.date.slice(0, 4)))].sort().reverse();
  const count = (y: string) => items.filter((r) => r.date.startsWith(y)).length;
  const props = extra(block.attrs, 'section');
  const className = ['photo-reports', block.joined && 'photo-reports--joined', props.className].filter(Boolean).join(' ');
  const yearButtons = years.length > 1 && (
    <div className="photo-reports__years" role="group" aria-label="Год">
      <button type="button" className="photo-reports__year is-active" data-year="" aria-pressed="true">
        Все годы <span>{items.length}</span>
      </button>
      {years.map((y) => (
        <button key={y} type="button" className="photo-reports__year" data-year={y} aria-pressed="false">
          {y} <span>{count(y)}</span>
        </button>
      ))}
    </div>
  );
  // в продолжении раздела выбор скрыт, пока скрипт не переставит его к заголовку раздела выше
  const regionSelect = regions.length > 1 && (
    <label className="photo-reports__regions" data-report-regions="" hidden={block.joined || undefined}>
      <span className="photo-reports__regions-label">Регион</span>
      <span className="photo-reports__select">
        <select data-report-region="" defaultValue={region}>
          <option value="">Все регионы</option>
          {regions.map((g) => (
            <option key={g.label} value={g.label} data-regions={g.regions.join('|')}>
              {g.label}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
  return (
    <section id={id} data-photo-reports="" data-page-size={block.pageSize} {...props} className={className}>
      <div className="photo-reports__inner">
        {block.joined ? (
          (yearButtons || regionSelect) && (
            <div className="photo-reports__head">
              <Inline as="span" className="photo-reports__label" html={block.yearsLabel} />
              {yearButtons}
              {regionSelect}
            </div>
          )
        ) : (
          <div className="photo-reports__head">
            <div className="photo-reports__heading">
              {block.head.eyebrow && <Inline as="span" className="photo-reports__eyebrow" html={block.head.eyebrow} />}
              <Inline as="h2" className="photo-reports__title" html={block.head.title} />
              {block.head.lead && <Inline as="p" className="photo-reports__lead" html={block.head.lead} />}
            </div>
            {(regionSelect || yearButtons) && (
              <div className="photo-reports__filters">
                {regionSelect}
                {yearButtons}
              </div>
            )}
          </div>
        )}

        <div className="photo-reports__grid">
          {items.map((r, i) => {
            const cover = r.photos[0];
            return (
              <article
                key={r.id}
                className="report-card"
                data-year={r.date.slice(0, 4)}
                data-region={r.region.trim()}
                data-order={order.get(r.id)}
                hidden={i >= block.pageSize || undefined}
              >
                <div className="report-card__photo">
                  <img
                    className="report-card__img"
                    src={cover.src}
                    alt={cover.alt || r.title}
                    loading="lazy"
                    decoding="async"
                    {...responsiveProps(cover.src, 'report-card__img')}
                  />
                  <span className="report-card__badge">
                    {photoReportMonth(r.date)}
                    {r.region.trim() ? ` · ${r.region.trim()}` : ''}
                  </span>
                  <span className="report-card__count">
                    <Camera />
                    {r.photos.length}
                    {r.videos.length > 0 && (
                      <>
                        <Play />
                        {r.videos.length}
                      </>
                    )}
                  </span>
                </div>
                <div className="report-card__body">
                  <span className="report-card__kind">{PHOTO_REPORT_KINDS[r.kind]}</span>
                  <h3 className="report-card__title">
                    <button type="button" className="report-card__open" data-report={i} aria-haspopup="dialog">
                      {r.title}
                    </button>
                  </h3>
                  {r.text.trim() && <p className="report-card__text">{excerpt(r.text)}</p>}
                </div>
              </article>
            );
          })}
        </div>
        {/* дошли до него прокруткой — показываются следующие pageSize карточек */}
        {items.length > block.pageSize && <div className="photo-reports__sentinel" data-reports-sentinel="" aria-hidden="true"></div>}
      </div>

      <script type="application/json" className="photo-reports__data" dangerouslySetInnerHTML={{ __html: modalData(items) }} />

      <dialog className="report-modal" aria-labelledby={`${id}-modal-title`}>
        <div className="report-modal__box">
          {/* на телефоне — шапка «шторки»: ручка и кнопка закрытия; на ПК — только кнопка в углу */}
          <div className="report-modal__head">
            <span className="report-modal__grip" aria-hidden="true"></span>
            <button type="button" className="report-modal__close" data-report-close="" aria-label="Закрыть">
              <Close />
            </button>
          </div>
          <div className="report-modal__body">
            <div className="report-modal__media">
              <div className="report-modal__stage" data-stage="">
                <div className="report-modal__frame" data-frame=""></div>
                <button type="button" className="report-modal__nav report-modal__nav--prev" data-step="-1" aria-label="Предыдущий кадр">
                  <Chevron dir={-1} />
                </button>
                <button type="button" className="report-modal__nav report-modal__nav--next" data-step="1" aria-label="Следующий кадр">
                  <Chevron dir={1} />
                </button>
                <span className="report-modal__counter" data-counter=""></span>
              </div>
              <div className="report-modal__thumbs" data-thumbs=""></div>
            </div>
            <div className="report-modal__info">
              <span className="report-modal__kind" data-kind=""></span>
              <h2 className="report-modal__title" id={`${id}-modal-title`} data-title=""></h2>
              <ul className="report-modal__meta">
                <li>
                  <Calendar />
                  <span data-date=""></span>
                </li>
                <li data-place-row="">
                  <Pin />
                  <span data-place=""></span>
                </li>
              </ul>
              <div className="report-modal__text" data-text=""></div>
              {ctx.hasLeadgenBlock && (
                <div className="report-modal__cta-bar">
                  <a className="btn btn--primary report-modal__cta" href="#leadgen" data-report-cta="">
                    Обсудить похожий проект
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </dialog>
    </section>
  );
}
