import { z } from 'zod';
import { element, href, text } from './fields.ts';

/**
 * Настройки сайта: контакты, реквизиты, меню шапки, мобильное меню, подвал.
 * Хранятся в контент-сервисе одной записью, редактируются в админке
 * (раздел «Настройки»); шапка и подвал сайта строятся из них.
 */

const link = z.object({ href: href(), label: text('Подпись') });
export type NavLink = z.infer<typeof link>;

// ── Контакты и реквизиты ───────────────────────────────────────────────────

const phone = z.object({
  href: href('Ссылка (tel:+7…)'),
  text: text('Номер, как показывать'),
  label: text('Подпись для скринридера (в шапке)'),
  local: z.boolean().default(false).describe('Городской номер (на телефонах в шапке не показывается)'),
});

export const contactsSettings = z.object({
  hours: text('Режим работы (пусто — в шапке не показывается)').optional(),
  phones: z.array(phone).describe('Телефоны'),
  email: text('E-mail'),
  telegram: href('Telegram').optional(),
  max: href('MAX').optional(),
  instagram: href('Instagram').optional(),
  tiktok: href('TikTok').optional(),
});
export type ContactsSettings = z.infer<typeof contactsSettings>;

export const companySettings = z.object({
  tagline: text('Подпись под логотипом в подвале'),
  copyright: text('Копирайт'),
  legal: text('Реквизиты (ОГРН, ИНН)'),
});
export type CompanySettings = z.infer<typeof companySettings>;

// ── Шапка: главное меню и мегаменю ────────────────────────────────────────

const megaLink = z.object({
  href: href(),
  title: text('Название'),
  desc: text('Описание'),
  icon: element('Иконка: содержимое <svg> 24×24'),
});

const megaColumn = z.object({
  title: text('Заголовок колонки'),
  links: z.array(megaLink).describe('Пункты'),
});

const megaFeature = z.object({
  eyebrow: text('Надзаголовок'),
  title: text('Заголовок'),
  text: text('Текст'),
  link,
});

const navItem = z.object({
  key: text('Раздел (для подсветки текущего пункта)'),
  href: href(),
  label: text('Подпись'),
  mega: z
    .object({
      feature: megaFeature.optional().describe('Карточка слева'),
      columns: z.array(megaColumn).describe('Колонки'),
    })
    .optional()
    .describe('Выпадающее мегаменю'),
});
export type NavItem = z.infer<typeof navItem>;

// ── Мобильное меню ─────────────────────────────────────────────────────────

const drawerGroup = z.object({
  label: text('Заголовок группы').optional(),
  links: z.array(link).describe('Ссылки'),
});

const drawerItem = z.object({
  label: text('Подпись'),
  icon: element('Иконка: содержимое <svg> 24×24'),
  href: href().optional().describe('Ссылка (для обычного пункта)'),
  groups: z.array(drawerGroup).optional().describe('Подпункты (раскрывающийся пункт)'),
  all: link.optional().describe('Ссылка «Весь раздел →» в конце списка'),
});
export type DrawerItem = z.infer<typeof drawerItem>;

// ── Подвал ─────────────────────────────────────────────────────────────────

const footerColumn = z.object({
  title: text('Заголовок колонки'),
  links: z.array(link).describe('Ссылки'),
});

// ── Оформление: кнопки ───────────────────────────────────────────────────

const hexColor = (label: string) => z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Цвет — в виде #rrggbb').describe(label);

/**
 * Скругление и цвета кнопок на всех страницах (админка: вкладка «Оформление:
 * кнопки»). Не задано — как в дизайне сайта; вывод — content-kit/src/design.ts.
 */
export const designSettings = z.object({
  buttonRadius: z.number().int().min(0).max(30).optional().describe('Скругление углов кнопок, px (30 — «таблетка»)'),
  buttonColor: hexColor('Цвет кнопок').optional(),
  buttonTextColor: hexColor('Цвет текста на кнопках').optional(),
  buttonOutlineColor: hexColor('Цвет контурных кнопок (рамка и текст)').optional(),
});
export type DesignSettings = z.infer<typeof designSettings>;

export const siteSettings = z.object({
  contacts: contactsSettings.describe('Контакты'),
  company: companySettings.describe('Компания'),
  nav: z.array(navItem).describe('Главное меню'),
  drawer: z.array(drawerItem).describe('Мобильное меню'),
  footer: z
    .object({
      columns: z.array(footerColumn).describe('Колонки ссылок'),
      bottomLinks: z.array(link).describe('Ссылки внизу (документы)'),
    })
    .describe('Подвал'),
  design: designSettings.optional().describe('Оформление: кнопки'),
});
export type SiteSettings = z.infer<typeof siteSettings>;

// ── Значения по умолчанию: сайт uralinduktor.ru на момент переноса ────────

const ICON = {
  furnace: '<rect x="4" y="4" width="16" height="16"/><path d="M12 9c-1.5 1.5-1.5 4.5 0 6 1.5-1.5 1.5-4.5 0-6z"/><path d="M8 19h8"/>',
  heater: '<path d="M3 7c2.5-2.5 6 2.5 9 0s6-2.5 9 0"/><path d="M3 12c2.5-2.5 6 2.5 9 0s6-2.5 9 0"/><path d="M3 17c2.5-2.5 6 2.5 9 0s6-2.5 9 0"/>',
  shot: '<circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="5" cy="6" r="0.8" fill="currentColor"/><circle cx="19" cy="7" r="0.8" fill="currentColor"/><circle cx="6" cy="18" r="0.8" fill="currentColor"/><circle cx="19" cy="18" r="0.8" fill="currentColor"/><path d="M8.5 8.5L6 6M15.5 8.5L18 6M8.5 15.5L6 18M15.5 15.5L18 18"/>',
  sand: '<path d="M3 8h7l4-3v14l-4-3H3z"/><path d="M17 8l4-1M17 12h4M17 16l4 1"/>',
  cooling: '<path d="M12 3c2 3 5 6 5 9a5 5 0 0 1-10 0c0-3 3-6 5-9z"/><path d="M10 14a2 2 0 0 0 4 0" opacity="0.6"/>',
  aluminium: '<path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z"/><path d="M9 15a3 3 0 0 0 6 0" opacity="0.6"/>',
  pgs: '<path d="M3 18h18"/><path d="M5 18c0-3 2-5 5-5s5 2 5 5"/><path d="M10 18c0-2 2-4 5-4s4 2 4 4"/><circle cx="7" cy="20" r="0.5" fill="currentColor"/><circle cx="11" cy="20" r="0.5" fill="currentColor"/><circle cx="15" cy="20" r="0.5" fill="currentColor"/><circle cx="19" cy="20" r="0.5" fill="currentColor"/>',
  hts: '<rect x="3" y="14" width="18" height="7"/><rect x="6" y="8" width="12" height="6"/><rect x="9" y="3" width="6" height="5"/>',
  lgm: '<path d="M6 19a4 4 0 0 1-1-7.9 5.5 5.5 0 0 1 10.7-1.5A4.5 4.5 0 0 1 18 19z"/><circle cx="10" cy="14" r="0.5" fill="currentColor"/><circle cx="14" cy="14" r="0.5" fill="currentColor"/>',
  lvm: '<path d="M12 3C12 3 5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12z"/>',
  core: '<rect x="3" y="13" width="18" height="8"/><rect x="7" y="8" width="10" height="5"/><path d="M10 8V5h4v3"/>',
  thermal: '<rect x="3" y="5" width="18" height="14"/><rect x="6" y="8" width="12" height="8"/><path d="M12 10c-1.5 1-1.5 3 0 4 1.5-1 1.5-3 0-4z" fill="currentColor" fill-opacity=".25"/><circle cx="18.5" cy="6.5" r="0.5" fill="currentColor"/>',
  parts: '<circle cx="8.5" cy="8.5" r="3"/><circle cx="16" cy="16" r="3"/><path d="M8.5 4v2M8.5 11v2M4 8.5h2M11 8.5h2 M16 12v2M16 20v0M12 16h2M20 16h0"/>',
  vacuum: '<path d="M5 21V11a7 7 0 0 1 14 0v10z"/><path d="M3 21h18"/><circle cx="12" cy="12" r="2"/><path d="M12 4V2M12 14v4"/>',
  ladle: '<path d="M5 7h12l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7z"/><path d="M5 7l-2-2M17 7l3-1l-1 4l-2-1"/><path d="M8 11h6"/>',
  stand: '<path d="M6 20h12"/><path d="M8 20V9h8v11"/><path d="M9 9V6h6v3"/><path d="M12 3v3"/><path d="M10 13h4"/>',
  bolt: '<path d="M13 3L4 14h7l-1 7 9-11h-7z"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 1-4 6.4l-6.7 6.7a2 2 0 0 1-2.7-2.7l6.7-6.7a4 4 0 0 1 6.7-3.7z"/><circle cx="5.5" cy="18.5" r="0.5" fill="currentColor"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c2 1.3 4 2 6 2s4-0.7 6-2v-5"/><path d="M22 9v6"/>',
  arc: '<rect x="4" y="4" width="16" height="16"/><path d="M13 8l-4 5h3l-1 4 4-5h-3l1-4z"/>',
  audit: '<path d="M3 3h18v6H3z"/><path d="M3 13h18v8H3z"/><path d="M7 6h.01M11 6h.01M7 17h6M7 19h4"/>',
};

/** Иконки мобильного меню — набор Lucide (ISC), контурные 24×24. */
export const DRAWER_ICONS = {
  catalog: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  services: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>',
  stock: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>',
  projects: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  company: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  contacts: '<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>',
  reviews: '<path d="M14 14a2 2 0 0 0 2-2V8h-2"/><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="M8 14a2 2 0 0 0 2-2V8H8"/>',
  mail: '<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/>',
};

export const DEFAULT_SETTINGS: SiteSettings = {
  contacts: {
    phones: [{ href: 'tel:+77758534095', text: '+7 (775) 853-40-95', label: 'Позвонить', local: false }],
    email: 'stasgross.ru@gmail.com',
    telegram: 'https://t.me/uralinduktor',
    instagram: 'https://www.instagram.com/reel/DNF-x6zsaDt/?igsh=MWJsZjZmbmM5ZzRhOA==',
    tiktok: 'https://www.tiktok.com/@stas_gross?_r=1&_t=ZS-98IOPsrMYDw',
  },
  company: {
    tagline: 'Производство и поставка оборудования для металлургии и литейных производств с 2014 года.',
    copyright: '© 2026 ТОО «Gross Metal Engineering»',
    legal: 'Бенефициар: ТОО «Gross Metal Engineering» · БИН/ИИН 260440027830',
  },
  nav: [
    {
      key: 'catalog',
      href: '/products/',
      label: 'Каталог',
      mega: {
        columns: [
          {
            title: 'Плавка и\u00A0обработка металлов',
            links: [
              { href: '/products/induktsionnye-plavilnye-pechi/', title: 'Индукционные плавильные печи', desc: 'Тиристорные · от\u00A0100\u00A0кг до\u00A015\u00A0т', icon: ICON.furnace },
              { href: '/products/induktsionnye-nagrevateli/', title: 'Индукционные нагреватели', desc: 'Средне- и\u00A0высокочастотные · 1–1100\u00A0кГц', icon: ICON.heater },
              { href: '/products/drobemetnoe-oborudovanie/', title: 'Дробемётные установки', desc: 'Кранового и\u00A0барабанного типа', icon: ICON.shot },
              { href: '/products/peskostruynoe-oborudovanie/', title: 'Пескоструйные установки', desc: 'Проходные, напорные, ручные кабины', icon: ICON.sand },
              { href: '/products/sistemy-ohlazhdeniya/', title: 'Системы охлаждения', desc: 'Градирни и\u00A0чиллеры · до\u00A0900\u00A0000\u00A0кКал/ч', icon: ICON.cooling },
              { href: '/products/termoobrabotka-plavka-alyuminiya/', title: 'Термообработка и\u00A0плавка алюминия', desc: 'Тигельные, бассейновые, башенные печи', icon: ICON.aluminium },
            ],
          },
          {
            title: 'Производственные линии',
            links: [
              { href: '/products/oborudovanie-dlya-peschano-glinistyh-smesej-pgs/', title: 'ПГС', desc: 'Песчано-глинистые смеси', icon: ICON.pgs },
              { href: '/products/linii-dlya-holodnotverdeyushhih-smesej-hts/', title: 'ХТС', desc: 'Холодно-твердеющие смеси', icon: ICON.hts },
              { href: '/products/oborudovanie-lgm/', title: 'ЛГМ', desc: 'Литьё по\u00A0газифицируемым моделям', icon: ICON.lgm },
              { href: '/products/oborudovanie-lvm/', title: 'ЛВМ', desc: 'Литьё по\u00A0выплавляемым моделям', icon: ICON.lvm },
              { href: '/products/sterzhnevye-mashiny/', title: 'Стержневые и\u00A0формовочные машины', desc: 'Горячий/холодный ящик, формовка', icon: ICON.core },
            ],
          },
          {
            title: 'Доп оборудование',
            links: [
              { href: '/products/termicheskie-pechi/', title: 'Термические печи', desc: 'Камерные, шахтные, вакуумные · до\u00A01800\u00A0°C', icon: ICON.thermal },
              { href: '/products/zapchasti/', title: 'Запчасти на\u00A0оборудование', desc: 'Для\u00A0индукционного и\u00A0дробемётного оборудования', icon: ICON.parts },
              { href: '/products/vakuumnoe-oborudovanie-dlya-termoobrabotki/', title: 'Вакуумное оборудование', desc: 'Для\u00A0термообработки в\u00A0вакууме', icon: ICON.vacuum },
              { href: '/products/stalerozlivochnye-kovshi/', title: 'Сталеразливочные ковши', desc: 'Для\u00A0стали и\u00A0чугуна, стопорные, чайниковые', icon: ICON.ladle },
              { href: '/products/stendy-sushki-i-nagreva-kovshej/', title: 'Стенды сушки и\u00A0нагрева ковшей', desc: 'Газовые и\u00A0электрические · 11\u00A0исполнений', icon: ICON.stand },
            ],
          },
        ],
      },
    },
    {
      key: 'uslugi',
      href: '/uslugi/',
      label: 'Услуги',
      mega: {
        feature: {
          eyebrow: 'Под ключ',
          title: 'Проектирование литейного производства с\u00A0нуля под\u00A0ключ',
          text: 'От\u00A0аудита площадки и\u00A0инженерного проекта до\u00A0запуска участка, обучения операторов и\u00A0сервиса.',
          link: { href: '/proizvodstvo/', label: 'Обсудить проект' },
        },
        columns: [
          {
            title: 'Полный цикл запуска',
            links: [
              { href: '/uslugi/puskonaladka/', title: 'Пусконаладка', desc: 'Запуск оборудования на\u00A0площадке заказчика', icon: ICON.bolt },
              { href: '/uslugi/montazh-shefmontazh/', title: 'Монтаж и\u00A0шефмонтаж', desc: 'Сборка узлов, установка и\u00A0обвязка', icon: ICON.wrench },
              { href: '/uslugi/obuchenie-personala/', title: 'Обучение персонала', desc: 'Подготовка операторов и\u00A0инженеров', icon: ICON.cap },
            ],
          },
          {
            title: 'Аудит, ремонт и\u00A0модернизация',
            links: [
              { href: '/uslugi/remont-plavilnyh-pechey/', title: 'Плавильных печей', desc: 'Диагностика, замена узлов, модернизация', icon: ICON.furnace },
              { href: '/uslugi/remont-dugovyh-pechey/', title: 'Дуговых печей', desc: 'Реновация ДСП, модернизация АСУ\u00A0ТП', icon: ICON.arc },
              { href: '/uslugi/remont-drobemetov/', title: 'Дробемётных установок', desc: 'Восстановление и\u00A0переоснащение', icon: ICON.shot },
              { href: '/uslugi/tehnicheskij-audit/', title: 'Технический аудит', desc: 'Оценка состояния и\u00A0слабых мест оборудования', icon: ICON.audit },
            ],
          },
        ],
      },
    },
    { key: 'nalichie', href: '/nalichie/', label: 'Наличие' },
    { key: 'proekty', href: '/proekty/', label: 'Проекты' },
    { key: 'o-kompanii', href: '/o-company/', label: 'О компании' },
    { key: 'kontakty', href: '/kontakty/', label: 'Контакты' },
    { key: 'otzyvy', href: '/otzyvy/', label: 'Отзывы' },
  ],
  drawer: [
    {
      label: 'Каталог',
      icon: DRAWER_ICONS.catalog,
      groups: [
        {
          label: 'Плавка и\u00A0обработка металлов',
          links: [
            { href: '/products/induktsionnye-plavilnye-pechi/', label: 'Индукционные плавильные печи' },
            { href: '/products/induktsionnye-nagrevateli/', label: 'Индукционные нагреватели' },
            { href: '/products/drobemetnoe-oborudovanie/', label: 'Дробемётные установки' },
            { href: '/products/sistemy-ohlazhdeniya/', label: 'Системы охлаждения' },
          ],
        },
        {
          label: 'Производственные линии',
          links: [
            { href: '/products/linii-dlya-holodnotverdeyushhih-smesej-hts/', label: 'ХТС — холодно-твердеющие смеси' },
            { href: '/products/oborudovanie-lvm/', label: 'ЛВМ — литьё по\u00A0выплавляемым моделям' },
            { href: '/products/oborudovanie-lgm/', label: 'ЛГМ — литьё по\u00A0газифицируемым моделям' },
            { href: '/products/oborudovanie-dlya-peschano-glinistyh-smesej-pgs/', label: 'ПГС — песчано-глинистые смеси' },
          ],
        },
      ],
      all: { href: '/products/', label: 'Весь каталог\u00A0→' },
    },
    {
      label: 'Услуги',
      icon: DRAWER_ICONS.services,
      groups: [
        {
          links: [
            { href: '/uslugi/puskonaladka/', label: 'Пусконаладка' },
            { href: '/uslugi/montazh-shefmontazh/', label: 'Монтаж и\u00A0шефмонтаж' },
            { href: '/uslugi/obuchenie-personala/', label: 'Обучение персонала' },
            { href: '/uslugi/remont-plavilnyh-pechey/', label: 'Ремонт плавильных печей' },
            { href: '/uslugi/remont-drobemetov/', label: 'Ремонт дробемётов' },
            { href: '/uslugi/tehnicheskij-audit/', label: 'Технический аудит' },
          ],
        },
      ],
    },
    { label: 'Наличие', href: '/nalichie/', icon: DRAWER_ICONS.stock },
    { label: 'Проекты', href: '/proekty/', icon: DRAWER_ICONS.projects },
    { label: 'О\u00A0компании', href: '/o-company/', icon: DRAWER_ICONS.company },
    { label: 'Контакты', href: '/kontakty/', icon: DRAWER_ICONS.contacts },
    { label: 'Отзывы', href: '/otzyvy/', icon: DRAWER_ICONS.reviews },
  ],
  footer: {
    columns: [
      {
        title: 'Основное оборудование',
        links: [
          { href: '/products/induktsionnye-plavilnye-pechi/', label: 'Индукционные плавильные печи' },
          { href: '/products/induktsionnye-nagrevateli/', label: 'Индукционные нагреватели' },
          { href: '/products/drobemetnoe-oborudovanie/', label: 'Дробемётное оборудование' },
          { href: '/products/sistemy-ohlazhdeniya/', label: 'Системы охлаждения' },
          { href: '/products/oborudovanie-lvm/', label: 'Оборудование ЛВМ' },
          { href: '/products/oborudovanie-lgm/', label: 'Оборудование ЛГМ' },
          { href: '/products/linii-dlya-holodnotverdeyushhih-smesej-hts/', label: 'Линии ХТС' },
          { href: '/products/oborudovanie-dlya-peschano-glinistyh-smesej-pgs/', label: 'Оборудование ПГС' },
          { href: '/products/sterzhnevye-mashiny/', label: 'Стержневые и\u00A0формовочные машины' },
          { href: '/products/termoobrabotka-plavka-alyuminiya/', label: 'Термообработка и\u00A0плавка алюминия' },
        ],
      },
      {
        title: 'Допоборудование',
        links: [
          { href: '/products/termicheskie-pechi/', label: 'Термические печи' },
          { href: '/products/zapchasti/', label: 'Запчасти на\u00A0оборудование' },
          { href: '/products/vakuumnoe-oborudovanie-dlya-termoobrabotki/', label: 'Вакуумное оборудование' },
          { href: '/products/stalerozlivochnye-kovshi/', label: 'Сталеразливочные ковши' },
        ],
      },
      {
        title: 'Услуги',
        links: [
          { href: '/uslugi/montazh-shefmontazh/', label: 'Монтаж и\u00A0шефмонтаж' },
          { href: '/uslugi/puskonaladka/', label: 'Пусконаладка' },
          { href: '/uslugi/obuchenie-personala/', label: 'Обучение персонала' },
          { href: '/uslugi/tehnicheskij-audit/', label: 'Технический аудит' },
          { href: '/proizvodstvo/', label: 'Производство под\u00A0ключ' },
          { href: '/uslugi/remont-plavilnyh-pechey/', label: 'Ремонт плавильных печей' },
          { href: '/uslugi/remont-drobemetov/', label: 'Ремонт дробемётов' },
        ],
      },
      {
        title: 'Компания',
        links: [
          { href: '/o-company/', label: 'О\u00A0компании' },
          { href: '/proekty/', label: 'Проекты и\u00A0кейсы' },
          { href: '/kontakty/', label: 'Контакты' },
          { href: '/otzyvy/', label: 'Отзывы' },
          { href: '/news/', label: 'Новости' },
        ],
      },
    ],
    bottomLinks: [
      { href: '/policy/', label: 'Политика конфиденциальности' },
      { href: '/soglasie/', label: 'Согласие на\u00A0обработку персональных данных' },
    ],
  },
};
