// Блок «Решения для задач вашего производства» (маркер partner) — общая секция сайта: под товарами
// (общие блоки категорий) и на главной. Пять направлений карточками с иконками (зелёные, набор Solar),
// карточка — ссылка на раздел; внизу — «Обсудить задачу» (форма заявки на странице).

/** Иконки Solar (линии 1.5) — содержимое <svg viewBox="0 0 24 24">. */
const ICONS = {
  select: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><path d="M9.5 14C11.16 14 12.5 15.34 12.5 17C12.5 18.66 11.16 20 9.5 20C7.84 20 6.5 18.66 6.5 17C6.5 15.34 7.84 14 9.5 14Z"/><path d="M14.5 4C12.84 4 11.5 5.34 11.5 7C11.5 8.66 12.84 10 14.5 10C16.16 10 17.5 8.66 17.5 7C17.5 5.34 16.16 4 14.5 4Z"/><path d="M15 16.96L22 16.96"/><path d="M9 6.96L2 6.96"/><path d="M2 16.96L4 16.96"/><path d="M22 6.96L20 6.96"/></g>',
  upgrade: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><path stroke-linejoin="round" d="M7.38 12.56L7.38 11.63C7.38 9.07 9.47 7 12.04 7C13.4 7 14.63 7.58 15.48 8.5M6 11L7.38 12.56L9 11"/><path stroke-linejoin="round" d="M16.62 11.45V12.37C16.62 14.93 14.52 17 11.93 17C10.58 17 9.36 16.43 8.5 15.52M18 13L16.62 11.45L15 13"/><circle cx="12" cy="12" r="10"/></g>',
  launch: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7.86 10.44C7.8 10.6 7.76 10.76 7.76 10.92C7.76 11.62 8.33 12.18 9.45 13.3L10.65 14.49C11.78 15.61 12.34 16.18 13.04 16.18C13.19 16.18 13.34 16.15 13.49 16.09C14.02 15.9 14.55 15.37 15.43 14.49L20.52 9.43C21.25 8.7 21.61 8.33 21.81 7.87C22 7.41 22 6.89 22 5.86L22 5.37C22 3.78 22 2.99 21.51 2.49C21.01 2 20.21 2 18.62 2H18.13C17.09 2 16.57 2 16.11 2.19C15.64 2.38 15.27 2.75 14.54 3.48L9.45 8.54C8.6 9.4 8.07 9.92 7.86 10.44ZM13.49 16.09L13.74 16.34L14.19 16.74C14.56 17.1 14.74 17.29 14.9 17.49C15.04 17.67 15.17 17.86 15.28 18.06C15.4 18.29 15.5 18.53 15.69 19.01C15.85 19.4 16.37 19.51 16.67 19.2L16.74 19.13C17.72 18.16 18.89 17 19.12 16.43C19.33 15.94 19.4 15.4 19.32 14.89C19.24 14.3 18.88 13.75 18.17 12.66L17.82 12.11M7.86 10.44L7.71 10.28L6.87 9.45C6.83 9.41 6.81 9.39 6.79 9.37C6.41 9 5.95 8.7 5.46 8.5C5.43 8.48 5.4 8.47 5.35 8.45L5.02 8.32C4.58 8.15 4.46 7.57 4.8 7.23C5.77 6.26 6.94 5.1 7.51 4.86C8 4.66 8.54 4.59 9.06 4.67C9.65 4.75 10.2 5.11 11.3 5.81L11.84 6.16M10.05 13.9L11.84 12.11M5.55 12.89L3.86 14.58C3.43 15 2.74 15 2.32 14.58C1.89 14.15 1.89 13.46 2.32 13.04L2.47 12.89M11.08 18.46L9.38 20.15C8.96 20.57 8.96 21.26 9.38 21.68C9.81 22.11 10.5 22.11 10.92 21.68L11.08 21.53M10.1 16.66L8 18.76M7.33 13.88L5.21 16M6.94 17.05L5.23 18.72M17.82 8.54C17.16 9.2 16.09 9.2 15.43 8.54C14.77 7.89 14.77 6.82 15.43 6.16C16.09 5.51 17.16 5.51 17.82 6.16C18.48 6.82 18.48 7.89 17.82 8.54Z"/>',
  support: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><path d="M2 12C2 7.29 2 4.93 3.46 3.46C4.93 2 7.29 2 12 2C16.71 2 19.07 2 20.54 3.46C22 4.93 22 7.29 22 12C22 16.71 22 19.07 20.54 20.54C19.07 22 16.71 22 12 22C7.29 22 4.93 22 3.46 20.54C2 19.07 2 16.71 2 12Z"/><path stroke-linejoin="round" d="M7 14L9.29 11.71C9.68 11.32 10.32 11.32 10.71 11.71L12.29 13.29C12.68 13.68 13.32 13.68 13.71 13.29L17 10M14.5 10H17V12.5"/></g>',
  service: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><rect width="12.05" height="20" x="2" y="18.05" rx="3" transform="rotate(-90 2 18.05)"/><path d="M16.52 6C16.52 6.01 16.52 5.99 16.52 6ZM16.52 6C16.52 4.11 16.52 3.17 15.93 2.59C15.35 2 14.41 2 12.52 2H11.48C9.59 2 8.65 2 8.07 2.59C7.48 3.17 7.48 4.11 7.48 6"/><path d="M2 12C2.81 12 4.19 12 5 12"/><path d="M18.78 12C19.66 12 21.12 12 22 12"/><path d="M8.78 12C11.23 12 12.55 12 15 12"/><path d="M8.41 11H5.38C5.17 11 5 11.17 5 11.38V13.01C5 13.17 5.09 13.31 5.24 13.37L5.77 13.58C6.49 13.87 7.29 13.87 8.02 13.58L8.55 13.37C8.69 13.31 8.78 13.17 8.78 13.01V11.38C8.78 11.17 8.61 11 8.41 11Z"/><path d="M18.41 11H15.38C15.17 11 15 11.17 15 11.38V13.01C15 13.17 15.09 13.31 15.24 13.37L15.77 13.58C16.49 13.87 17.29 13.87 18.02 13.58L18.55 13.37C18.69 13.31 18.78 13.17 18.78 13.01V11.38C18.78 11.17 18.61 11 18.41 11Z"/></g>',
  go: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M18 15V6H9"/>',
};

type IconName = keyof typeof ICONS;

const Icon = ({ name, className }: { name: IconName; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className} dangerouslySetInnerHTML={{ __html: ICONS[name] }} />
);

/** Направления: иконка, название, пояснение, куда ведёт карточка. */
const ITEMS: { icon: IconName; title: string; text: string; href: string }[] = [
  { icon: 'select', title: 'Подбор оборудования', text: 'Под\u00A0вашу технологическую задачу', href: '/products/' },
  { icon: 'upgrade', title: 'Модернизация участка', text: 'Обновление действующего оборудования', href: '/uslugi/tehnicheskij-audit/' },
  { icon: 'launch', title: 'Запуск производства', text: 'Новое производственное направление', href: '/proizvodstvo/' },
  { icon: 'support', title: 'Поддержка производства', text: 'Стабильная работа действующего оборудования', href: '/uslugi/' },
  { icon: 'service', title: 'Сервис и\u00A0запчасти', text: 'Обслуживание и\u00A0поставка комплектующих', href: '/products/zapchasti/' },
];

export function Partner() {
  return (
    <section className="solve" aria-label="Решения для задач вашего производства">
      <div className="container">
        <div className="solve__head">
          <div>
            <div className="solve__eyebrow">{'УралИндуктор · с\u00A02014\u00A0года'}</div>
            <h2 className="solve__title">
              Решения для&nbsp;задач <em>вашего производства</em>
            </h2>
          </div>
          <p className="solve__lead">{'Полный цикл работ с\u00A0оборудованием для\u00A0литейных, металлургических и\u00A0машиностроительных предприятий.'}</p>
        </div>
        <ul className="solve__grid">
          {ITEMS.map((it, i) => (
            <li key={it.href}>
              <a className="solve-card" href={it.href}>
                <span className="solve-card__top">
                  <Icon name={it.icon} className="solve-card__icon" />
                  <span className="solve-card__num">{String(i + 1).padStart(2, '0')}</span>
                </span>
                <span className="solve-card__title">{it.title}</span>
                <span className="solve-card__text">{it.text}</span>
                <Icon name="go" className="solve-card__go" />
              </a>
            </li>
          ))}
        </ul>
        <div className="solve__foot">
          <p className="solve__foot-text">Не знаете, с&nbsp;чего начать? Обсудим вашу задачу.</p>
          <a href="#leadgen" className="btn btn--green">
            Обсудить задачу <span className="btn__arrow" aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
