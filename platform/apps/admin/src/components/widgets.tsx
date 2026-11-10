'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { BlockData, BlockSchemas } from './BlockList';
import { Icon, type IconName } from './icons';
import { defaultFor } from './schema-form';

/**
 * Виджеты конструктора: какие блоки можно добавить на страницу, с иконкой и
 * пояснением, и чем заполнить новый блок, чтобы он сразу выглядел как надо.
 * Панель «Добавить блок» (как в Elementor) открывают «+» в списке блоков и
 * «+» прямо в предпросмотре.
 */
export type Widget = { type: string; label: string; hint: string; icon: IconName };
export const WIDGET_GROUPS: { title: string; note?: string; items: Widget[] }[] = [
  {
    title: 'Основное',
    items: [
      { type: 'richText', label: 'Текст', hint: 'Заголовок и текст с форматированием: абзацы, списки, ссылки', icon: 'text' },
      { type: 'cta', label: 'Призыв с кнопкой', hint: 'Крупный заголовок, текст и кнопка — можно на фоне фото', icon: 'cta' },
      { type: 'features', label: 'Колонки с преимуществами', hint: 'Иконка или номер, заголовок и текст в 2–4 колонки', icon: 'features' },
      { type: 'form-section', label: 'Секция с формой заявки', hint: 'Заголовок, текст и форма заявки — заявки уходят в CRM', icon: 'form' },
      { type: 'spacer', label: 'Отступ', hint: 'Пустое место между блоками, можно с тонкой линией', icon: 'spacer' },
    ],
  },
  {
    title: 'Фото и видео',
    items: [
      { type: 'gallery', label: 'Сетка фото', hint: 'Фото плиткой в 2–6 колонок, открываются на весь экран', icon: 'gallery' },
      { type: 'carousel', label: 'Карусель', hint: 'Слайды листаются стрелками и свайпом, есть автопрокрутка', icon: 'carousel' },
      { type: 'video', label: 'Видео', hint: 'YouTube, RuTube, VK Видео или свой файл .mp4', icon: 'video' },
      { type: 'photoReports', label: 'Фотоотчёты с объектов', hint: 'Отгрузки и запуски из раздела «Фотоотчёты»: карточки, годы, окно с фото и видео', icon: 'camera' },
    ],
  },
  {
    title: 'Движение и цифры',
    items: [
      { type: 'marquee', label: 'Бегущая строка', hint: 'Бесконечная лента слов или логотипов', icon: 'marquee' },
      { type: 'stats', label: 'Показатели', hint: 'Цифры с иконками: годы, проекты, регионы', icon: 'stats' },
      { type: 'faq', label: 'Вопросы и ответы', hint: 'Список вопросов, ответ раскрывается по щелчку', icon: 'faq' },
    ],
  },
  {
    title: 'Общие секции сайта',
    note: 'Сверстаны один раз и одинаковы на всех страницах',
    items: [
      { type: 'leadgen', label: 'Форма «Подбор и расчёт»', hint: 'Большая форма заявки', icon: 'letter' },
      { type: 'bestOffer', label: 'Лучшее предложение', hint: 'Короткая форма коммерческого предложения', icon: 'medal' },
      { type: 'catalogCta', label: 'Запрос КП по каталогу', hint: 'Призыв запросить КП', icon: 'cta' },
      { type: 'adv', label: 'Преимущества производства', hint: 'Собственное производство в цифрах', icon: 'shieldStar' },
      { type: 'whyUs', label: 'Почему мы', hint: '«Почему выбирают УралИндуктор»', icon: 'like' },
      { type: 'partner', label: 'Решения для задач', hint: '«Решения для задач вашего производства» — пять направлений с иконками', icon: 'handshake' },
    ],
  },
  {
    title: 'Каталог и товары',
    items: [
      { type: 'catalogCards', label: 'Карточки каталога', hint: 'Разделы каталога — из данных каталога', icon: 'catalog' },
      { type: 'catalogList', label: 'Товары с фильтром', hint: 'Сетка карточек товаров', icon: 'list' },
      { type: 'categoryHero', label: 'Обложка раздела', hint: 'Заголовок, фон, экспресс-заявка', icon: 'media' },
      { type: 'productHero', label: 'Шапка товара', hint: 'Фото, название, ключевые характеристики', icon: 'stock' },
      { type: 'productSpec', label: 'Характеристики и описание', hint: 'Разделы описания и таблицы', icon: 'pages' },
    ],
  },
  {
    title: 'Код и служебные',
    items: [
      { type: 'html', label: 'HTML-секция', hint: 'Любая вёрстка HTML-кодом', icon: 'api' },
      { type: 'script', label: 'Скрипт', hint: 'Анимации и поведение страницы (TS/JS)', icon: 'code' },
      { type: 'style', label: 'Стили (CSS)', hint: 'Оформление секций этой страницы', icon: 'palette' },
      { type: 'container', label: 'Контейнер', hint: 'Обёртка, внутри — другие блоки', icon: 'container' },
      { type: 'lightbox', label: 'Просмотр фото', hint: 'Фото на весь экран (для галереи товара)', icon: 'maximize' },
      { type: 'text', label: 'Простой текст', hint: 'Текст без оформления', icon: 'textPlain' },
    ],
  },
];

/** Плитки-заготовки: блок создаётся не по схеме, а готовым (HTML-секция, контейнер, секция с формой). */
const VIRTUAL = new Set(['container', 'form-section', 'html']);

/** Заготовка новой HTML-секции: отступы и заголовок — как у секций сайта. */
const STARTER_HTML = `<section class="cms-section" aria-label="Новая секция">
  <div class="container">
    <div class="s-head">
      <div class="s-eyebrow">Надзаголовок</div>
      <h2 class="s-title">Заголовок <em>секции</em></h2>
      <p class="s-lead">Текст секции.</p>
    </div>
  </div>
</section>`;

/**
 * Секция с формой заявки: блок «Подбор и расчёт» (вёрстка одна на весь сайт)
 * со своими текстами. Своё название формы — источник заявки в CRM, свой
 * якорь — чтобы не повторять id="leadgen".
 */
const FORM_SECTION: BlockData = {
  type: 'leadgen',
  eyebrow: 'Подбор и&nbsp;расчёт',
  title: 'Обсудим вашу задачу — <em>заполните форму</em>',
  lead: 'Инженер свяжется с&nbsp;вами в&nbsp;течение рабочего дня и&nbsp;уточнит детали.',
  items: [],
  form: { name: 'Заявка со страницы', title: 'Запрос расчёта', taskPlaceholder: 'Например: нужна индукционная печь для чугуна на 1 т', submit: 'Отправить заявку' },
  attrs: { id: 'zayavka' },
};

/** Фото для заготовок: проекты компании из медиатеки — заменяются щелчком в предпросмотре. */
const SAMPLE_PHOTOS = [
  { src: '/img/proekty/cards/pavlodar.webp', alt: 'Проект в Павлодаре', caption: 'Павлодар' },
  { src: '/img/proekty/cards/ufa.webp', alt: 'Проект в Уфе', caption: 'Уфа' },
  { src: '/img/proekty/cards/lipetsk.webp', alt: 'Проект в Липецке', caption: 'Липецк' },
  { src: '/img/proekty/cards/magnitogorsk.webp', alt: 'Проект в Магнитогорске', caption: 'Магнитогорск' },
  { src: '/img/partner-hero-furnace-night.png', alt: 'Плавка металла в индукционной печи', caption: 'Плавильный участок' },
  { src: '/img/banner-modern-v2.png', alt: 'Модернизация оборудования', caption: 'Модернизация' },
];
const ICON_SVG = (d: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

/** Чем заполнен новый блок: заготовка, чтобы он сразу выглядел как на сайте. */
const STARTERS: Record<string, Record<string, unknown>> = {
  richText: {
    head: { title: 'Заголовок <em>раздела</em>' },
    body: '<p>Расскажите о&nbsp;главном: что вы делаете, для кого и&nbsp;чем это полезно. Текст можно править прямо в&nbsp;предпросмотре.</p><ul><li>Первое преимущество</li><li>Второе преимущество</li></ul>',
  },
  gallery: { head: { title: 'Наши <em>проекты</em>' }, photos: SAMPLE_PHOTOS, columns: 3 },
  carousel: { head: { title: 'Как это <em>выглядит</em>' }, slides: SAMPLE_PHOTOS, perView: 3 },
  marquee: {
    items: ['Индукционные печи', 'Дробемётные установки', 'Системы охлаждения', 'Запчасти со склада', 'Пусконаладка и обучение', 'Сервис'].map((text) => ({ text })),
  },
  video: { head: { title: 'Оборудование <em>в работе</em>' }, url: '' },
  features: {
    head: { title: 'Почему <em>с нами удобно</em>' },
    items: [
      { icon: ICON_SVG('M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4'), title: 'Гарантия 18 месяцев', text: 'На оборудование собственного производства' },
      { icon: ICON_SVG('M3 8h13v9H3zM16 11h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'), title: 'Доставка по России', text: 'Привезём, смонтируем и запустим' },
      { icon: ICON_SVG('M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z'), title: 'Сервис 24/7', text: 'Инженер на связи и выезд на объект' },
    ],
  },
  cta: {
    title: 'Нужен расчёт <em>под вашу задачу?</em>',
    text: 'Пришлём коммерческое предложение с&nbsp;ценой и&nbsp;сроками в&nbsp;течение рабочего дня.',
    button: { label: 'Получить предложение', href: '#leadgen' },
    image: '/img/partner-hero-furnace-night.png',
  },
};

/** Новый блок типа type. */
export function createBlock(type: string, schemas: BlockSchemas): BlockData {
  if (type === 'container') return { type: 'container', tag: 'div', children: [] };
  if (type === 'form-section') return structuredClone(FORM_SECTION);
  if (type === 'html') return { type: 'html', html: STARTER_HTML };
  const schema = schemas[type].schema;
  const base = defaultFor(schema, schema) as BlockData;
  // необязательные поля со значением по умолчанию (фон, колонки, пропорции) — сразу в блок: их видно в полях слева
  for (const [k, p] of Object.entries(schema.properties ?? {})) if (base[k] === undefined && p.default !== undefined) base[k] = structuredClone(p.default);
  return { ...base, ...structuredClone(STARTERS[type] ?? {}), type };
}

/** Виджеты, которые есть в этой версии (тип с неизвестной схемой не показываем); новые типы — к служебным. */
function available(schemas: BlockSchemas) {
  const listed = new Set(WIDGET_GROUPS.flatMap((g) => g.items.map((w) => w.type)));
  const extra = Object.keys(schemas)
    .filter((t) => !listed.has(t))
    .map((t): Widget => ({ type: t, label: schemas[t].label, hint: '', icon: 'container' }));
  return WIDGET_GROUPS.map((g, i) => ({
    ...g,
    items: [...g.items.filter((w) => VIRTUAL.has(w.type) || schemas[w.type]), ...(i === WIDGET_GROUPS.length - 1 ? extra : [])],
  }));
}

/**
 * Панель «Добавить блок» — слева, поверх списка блоков (как в Elementor):
 * поиск и плитки по группам. Esc или щелчок мимо — закрыть.
 */
export function WidgetPanel({ schemas, title, onPick, onClose }: { schemas: BlockSchemas; title: string; onPick: (type: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    search.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return available(schemas)
      .map((g) => ({ ...g, items: q ? g.items.filter((w) => `${w.label} ${w.hint} ${w.type}`.toLowerCase().includes(q)) : g.items }))
      .filter((g) => g.items.length);
  }, [schemas, query]);

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/20" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-label="Добавить блок" className="fixed top-0 bottom-0 left-60 flex w-[440px] max-w-[calc(100vw-15rem)] flex-col border-r border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pt-5 pb-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">Добавить блок</h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">{title}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Закрыть">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </header>
        <div className="border-b border-slate-100 px-5 py-3">
          <label className="relative block">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input ref={search} className="field pl-9" placeholder="Найти: фото, карусель, видео, текст…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {groups.map((g) => (
            <section key={g.title}>
              <h3 className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{g.title}</h3>
              {g.note && <p className="text-xs text-slate-400">{g.note}</p>}
              <div className="mt-2 grid grid-cols-2 gap-2">
                {g.items.map((w) => (
                  <button
                    key={w.type}
                    type="button"
                    onClick={() => onPick(w.type)}
                    className="group flex flex-col items-start gap-2 rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/50 hover:shadow-sm"
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition group-hover:bg-brand-100 group-hover:text-brand-700">
                      <Icon name={w.icon} className="h-5 w-5" />
                    </span>
                    <span className="text-sm leading-tight font-medium text-slate-800">{w.label}</span>
                    {w.hint && <span className="text-xs leading-snug text-slate-500">{w.hint}</span>}
                  </button>
                ))}
              </div>
            </section>
          ))}
          {!groups.length && <p className="py-8 text-center text-sm text-slate-500">Ничего не нашлось — попробуйте другое слово.</p>}
        </div>
      </aside>
    </div>
  );
}

/** Запрос на вставку: подпись (куда) и что сделать с выбранным типом. */
type InsertRequest = { title: string; onPick: (type: string) => void };
const BuilderContext = createContext<{ schemas: BlockSchemas; open: (r: InsertRequest) => void } | null>(null);

/** Конструктор в редакторе: одна панель «Добавить блок» для списка блоков и предпросмотра. */
export function BuilderProvider({ schemas, children }: { schemas: BlockSchemas; children: ReactNode }) {
  const [request, setRequest] = useState<InsertRequest | null>(null);
  const value = useMemo(() => ({ schemas, open: setRequest }), [schemas]);
  return (
    <BuilderContext.Provider value={value}>
      {children}
      {request && (
        <WidgetPanel
          schemas={schemas}
          title={request.title}
          onClose={() => setRequest(null)}
          onPick={(type) => {
            setRequest(null);
            request.onPick(type);
          }}
        />
      )}
    </BuilderContext.Provider>
  );
}

export const useBuilder = () => useContext(BuilderContext);

/** Подпись блока для панели действий в предпросмотре. */
export function widgetLabel(type: string, schemas: BlockSchemas): string {
  if (type === 'html') return 'Секция';
  for (const g of WIDGET_GROUPS) for (const w of g.items) if (w.type === type) return w.label;
  return schemas[type]?.label ?? type;
}
