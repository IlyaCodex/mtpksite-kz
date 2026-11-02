import type { BestOfferBlock, ContactItem } from '@mtpk/content-model';
import { ShortForm } from '../forms/ShortForm.tsx';

/** Иконки Solar (линии 1.5) — содержимое <svg viewBox="0 0 24 24">. */
const ICONS = {
  phone:
    '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5" d="M18.68 19.96C19.19 19.91 19.64 19.63 20 19.25L21.42 17.76C22.38 16.75 22.11 15.02 20.88 14.31L18.97 13.21C18.17 12.75 17.19 12.88 16.56 13.55L16.1 14.03C16.1 14.03 15.02 15.17 12.06 12.06C9.11 8.94 10.19 7.81 10.19 7.81L10.48 7.5C11.18 6.76 11.25 5.56 10.63 4.69L9.37 2.91C8.61 1.83 7.14 1.69 6.26 2.61L4.69 4.26C4.26 4.72 3.97 5.31 4 5.97C4.09 7.65 4.81 11.26 8.82 15.48C13.06 19.95 17.05 20.12 18.68 19.96Z"/>',
  letter:
    '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><path d="M2 12C2 8.23 2 6.34 3.17 5.17C4.34 4 6.23 4 10 4H14C17.77 4 19.66 4 20.83 5.17C22 6.34 22 8.23 22 12C22 15.77 22 17.66 20.83 18.83C19.66 20 17.77 20 14 20H10C6.23 20 4.34 20 3.17 18.83C2 17.66 2 15.77 2 12Z"/><path d="M6 8L8.16 9.8C10 11.33 10.91 12.09 12 12.09C13.09 12.09 14 11.33 15.84 9.8L18 8"/></g>',
  pin: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><path d="M4 10.14C4 5.65 7.58 2 12 2C16.42 2 20 5.65 20 10.14C20 14.61 17.45 19.81 13.46 21.67C12.53 22.11 11.47 22.11 10.54 21.67C6.55 19.81 4 14.61 4 10.14Z"/><circle cx="12" cy="10" r="3"/></g>',
  clock: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path stroke-linejoin="round" d="M12 8V12L14.5 14.5"/></g>',
  documents:
    '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5"><path d="M5 8C5 6.18 5 4.95 5.23 4.07C5.36 3.58 5.56 3.19 5.88 2.88C6.76 2 8.17 2 11 2H13C15.83 2 17.24 2 18.12 2.88C19 3.76 19 5.17 19 8V16C19 18.83 19 20.24 18.12 21.12C17.24 22 15.83 22 13 22H11C8.17 22 6.76 22 5.88 21.12C5.56 20.81 5.36 20.42 5.23 19.93C5 19.05 5 17.82 5 16V8Z"/><path d="M5.23 19.93L5 19.92C4.02 19.83 3.37 19.61 2.88 19.12C2 18.24 2 16.83 2 14V10C2 7.17 2 5.76 2.88 4.88C3.37 4.39 4.02 4.17 5 4.08C5.07 4.07 5.15 4.07 5.23 4.07"/><path d="M18.77 19.93L19 19.92C19.98 19.83 20.63 19.61 21.12 19.12C22 18.24 22 16.83 22 14V10C22 7.17 22 5.76 21.12 4.88C20.63 4.39 19.98 4.17 19 4.08C18.93 4.07 18.85 4.07 18.77 4.07"/><path d="M9 13H15"/><path d="M9 9H15"/><path d="M9 17H12"/></g>',
};

const Icon = ({ name, className }: { name: keyof typeof ICONS; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className} dangerouslySetInnerHTML={{ __html: ICONS[name] }} />
);

/** Контакты компании — по умолчанию (свои у блока — поле contacts). Адрес начинает вторую группу (линия над ним). */
const CONTACTS: ContactItem[] = [
  { icon: 'phone', label: 'Единый контактный номер', value: '+7&nbsp;(775)&nbsp;853-40-95', meta: 'Отдел продаж и инженерный центр', href: 'tel:+77758534095' },
  { icon: 'letter', label: 'Электронная почта', value: 'stasgross.ru@gmail.com', meta: 'Ответ в течение рабочего дня', href: 'mailto:stasgross.ru@gmail.com' },
  { icon: 'pin', label: 'Адрес главного офиса', value: 'г. Астана, район Сарыарка, отель Radisson, офис 4' },
  { icon: 'clock', label: 'График работы', value: 'Пн&nbsp;—&nbsp;Пт, 9:00&nbsp;—&nbsp;18:00', meta: 'GMT+5 (Астана)' },
];

/**
 * Строка контакта: значок, подпись, значение, пояснение. Ссылка (tel:, mailto:) — только само значение,
 * растянутое на всю строку (components.css): коллтрекинг Mango заменяет содержимое ссылки на номер целиком,
 * и значок с подписью и пояснением пропадали. Номер — обычными пробелами (не переносится стилями): так его
 * находит и подменяет в тексте сам виджет.
 */
function Item({ icon, label, value, meta, href }: ContactItem) {
  return (
    <div className="bo-item">
      <span className="bo-item__icon">
        <Icon name={icon} />
      </span>
      <span className="bo-item__body">
        <span className="bo-item__label">{label}</span>
        {href ? (
          <a
            className="bo-item__value"
            href={href}
            dangerouslySetInnerHTML={{ __html: href.startsWith('tel:') ? value.replace(/&nbsp;/g, ' ') : value }}
          />
        ) : (
          <span className="bo-item__value" dangerouslySetInnerHTML={{ __html: value }} />
        )}
        {meta !== undefined && <span className="bo-item__meta">{meta}</span>}
      </span>
    </div>
  );
}

/**
 * Блок «Контакты» (общая секция): слева «Обсудим вашу задачу» — телефоны,
 * почта, адрес и график; справа карточка «Сравним КП»: прикрепить
 * коммерческое предложение (выбор или перетаскивание файла), телефон,
 * согласие, отправка (сервис заявок, форма «Лучшее предложение»).
 * anchorId — якорь секции: leadgen, если отдельного блока заявки на странице
 * нет (на него ведут кнопки «Обсудить задачу»), иначе best-offer — чтобы не
 * было двух id=leadgen.
 */
export function BestOffer({ block = { type: 'bestOffer' }, anchorId = 'leadgen' }: { block?: BestOfferBlock; anchorId?: string }) {
  const contacts = block.contacts?.length ? block.contacts : CONTACTS;
  const firstPin = contacts.findIndex((c) => c.icon === 'pin');
  const form = block.form ?? { name: 'Лучшее предложение', submit: 'Отправить КП на&nbsp;сравнение', file: 'Прикрепите коммерческое предложение.', fileHint: 'Выберите файл или перетащите его сюда.' };
  return (
    <section className="best-offer best-offer--v2" id={anchorId} aria-label="Контакты и сравнение коммерческих предложений">
      <div className="container">
        <div className="bo-layout">
          <div className="bo-info" id="contacts">
            <div className="bo-info__eyebrow">На&nbsp;связи с&nbsp;вами</div>
            <h2 className="bo-info__title">Обсудим вашу задачу</h2>
            <ul className="bo-info__list">
              {contacts.map((c, i) => (
                <li key={i} className={i > 0 && i === firstPin ? 'bo-info__group' : undefined}>
                  <Item {...c} />
                </li>
              ))}
            </ul>
          </div>
          <div className="bo-panel">
            <Icon name="documents" className="bo-panel__deco" />
            <div className="bo-panel__card">
              <div className="bo-panel__eyebrow" dangerouslySetInnerHTML={{ __html: block.eyebrow ?? 'Сравнение предложений' }} />
              <h2 className="bo-panel__title" dangerouslySetInnerHTML={{ __html: block.title ?? 'Сравним КП<br><em>и&nbsp;предложим наш вариант.</em>' }} />
              <p
                className="bo-panel__lead"
                dangerouslySetInnerHTML={{ __html: block.lead ?? 'Пришлите предложение другой компании — сравним состав оборудования, комплектацию и&nbsp;стоимость.' }}
              />
              <ShortForm
                variant="card"
                formName={form.name}
                submit={form.submit}
                phoneId="bo-card-phone"
                file={form.file ? { label: form.file, hint: form.fileHint ?? 'Выберите файл или перетащите его сюда.', id: 'bo-card-file' } : null}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
