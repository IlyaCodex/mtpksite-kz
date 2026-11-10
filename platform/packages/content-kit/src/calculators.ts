/**
 * Калькуляторы расчёта (страница /kalkulyatory/, блок calculators): плавка, расход дроби, смеси ХТС.
 * Поля, примеры, диапазоны и формулы — по пакету подрядчика (Desktop/Калькуляторы, 10.11.2026; методика — в его
 * METHOD.md): арифметический баланс массы, времени, энергии и стоимости, коэффициенты вводит посетитель или
 * подставляет выбранная модель из каталога. Подписи отсюда выводит сервер (на .kz их переводит словарь), скрипт
 * страницы только считает и вставляет числа. Модуль без зависимостей — его берут и разметка, и client/calculators.ts.
 */

export type CalcId = 'melt' | 'shot' | 'hts';
export const CALC_IDS: CalcId[] = ['melt', 'shot', 'hts'];

/** Значения полей и выборов калькулятора: числа — поля ввода, строки — выборы (режим, сплав, база программы). */
export type CalcValues = Record<string, number | string>;

export interface CalcField {
  key: string;
  label: string;
  /** «{cur}» — валюта блока; units — единица по значению выбора (база программы дроби) */
  unit: string;
  units?: { select: string; by: Record<string, string> };
  value: number;
  min: number;
  max: number;
  integer?: boolean;
  hint?: string;
  /** поле нужно только при этом значении выбора */
  when?: { select: string; is: string };
}
export interface CalcGroup {
  title: string;
  fields: CalcField[];
}
export interface CalcSelect {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}
export interface CalcOutput {
  key: string;
  label: string;
  unit: string;
  /** знаков после запятой, не больше */
  digits?: number;
}
export interface CalcDef {
  id: CalcId;
  /** подпись вкладки и адрес #… */
  tab: string;
  hash: string;
  title: string;
  /** выбор модели из каталога */
  equipment: { label: string; manual: string };
  catalog: { href: string; label: string };
  selects: CalcSelect[];
  groups: CalcGroup[];
  main: CalcOutput;
  /** строка под крупной цифрой: подпись, значение, единица; sep — перед частью (по умолчанию « · ») */
  note: (CalcOutput & { sep?: string })[];
  metrics: CalcOutput[];
  chart: { title: string; bars: CalcOutput[] };
}

export const CALCULATORS: Record<CalcId, CalcDef> = {
  melt: {
    id: 'melt',
    tab: 'Плавка',
    hash: 'plavka',
    title: 'Калькулятор плавки',
    equipment: { label: 'Печь', manual: 'Своя печь — ввести вручную' },
    catalog: { href: '/products/induktsionnye-plavilnye-pechi/', label: 'Индукционные печи' },
    selects: [
      {
        key: 'alloy',
        label: 'Сплав',
        options: [
          { value: 'iron', label: 'Чугун' },
          { value: 'steel', label: 'Сталь' },
          { value: 'aluminum', label: 'Алюминиевый сплав' },
          { value: 'copper', label: 'Медный сплав' },
          { value: 'other', label: 'Другой сплав' },
        ],
      },
      {
        key: 'mode',
        label: 'Расчёт энергии',
        options: [
          { value: 'measured', label: 'Фактический удельный расход' },
          { value: 'thermal', label: 'Полезная теплота и КПД' },
        ],
      },
    ],
    groups: [
      {
        title: 'Загрузка и мощность',
        fields: [
          { key: 'mass', label: 'Масса металлической шихты', unit: 'т', value: 1, min: 0.0001, max: 200 },
          { key: 'power', label: 'Мощность на вводе установки', unit: 'кВт', value: 800, min: 0.1, max: 100000 },
          { key: 'powerLoad', label: 'Средняя доля мощности', unit: '%', value: 90, min: 0.1, max: 100, hint: 'Средняя активная мощность в период плавки относительно введённой.' },
          { key: 'yield', label: 'Выход жидкого металла', unit: '%', value: 97, min: 0.1, max: 100, hint: 'Масса слитого жидкого металла относительно металлической шихты.' },
        ],
      },
      {
        title: 'Энергия плавки',
        fields: [
          {
            key: 'specific',
            label: 'Удельная электроэнергия',
            unit: 'кВт·ч/т шихты',
            value: 600,
            min: 0.1,
            max: 10000,
            hint: 'По паспорту печи или замерам, на том же вводе, что и мощность; только стадия плавки.',
            when: { select: 'mode', is: 'measured' },
          },
          { key: 'heat', label: 'Полезная теплота', unit: 'кВт·ч/т шихты', value: 400, min: 0.1, max: 10000, hint: 'Нагрев, плавление и перегрев для вашего сплава.', when: { select: 'mode', is: 'thermal' } },
          { key: 'efficiency', label: 'Общий КПД', unit: '%', value: 70, min: 0.1, max: 100, hint: 'От электрического ввода до металла.', when: { select: 'mode', is: 'thermal' } },
        ],
      },
      {
        title: 'Операции и стоимость',
        fields: [
          { key: 'extra', label: 'Загрузка, доводка и слив', unit: 'мин/цикл', value: 15, min: 0, max: 1440, hint: 'Время цикла вне расчётной плавки.' },
          { key: 'extraPower', label: 'Средняя мощность этих операций', unit: 'кВт', value: 50, min: 0, max: 100000 },
          { key: 'tariff', label: 'Тариф электроэнергии', unit: '{cur}/кВт·ч', value: 7, min: 0, max: 100000 },
          { key: 'shift', label: 'Длительность смены', unit: 'ч', value: 8, min: 0.1, max: 24 },
        ],
      },
    ],
    main: { key: 'cycle', label: 'Время полного цикла', unit: 'мин', digits: 0 },
    note: [
      { key: 'meltMin', label: 'Плавка', unit: 'мин', digits: 0 },
      { key: 'extra', label: 'операции', unit: 'мин', digits: 0, sep: ' + ' },
    ],
    metrics: [
      { key: 'cycleEnergy', label: 'Электроэнергия цикла', unit: 'кВт·ч', digits: 1 },
      { key: 'cost', label: 'Электроэнергия на цикл', unit: '{cur}', digits: 1 },
      { key: 'liquid', label: 'Жидкий металл', unit: 'т/цикл' },
      { key: 'rate', label: 'Производительность с операциями', unit: 'т/ч' },
      { key: 'cycles', label: 'Полных циклов в смене', unit: '', digits: 0 },
      { key: 'shiftOutput', label: 'Выпуск за смену', unit: 'т' },
    ],
    chart: {
      title: 'Время одного цикла',
      bars: [
        { key: 'meltMin', label: 'Плавка', unit: 'мин', digits: 0 },
        { key: 'extra', label: 'Дополнительные операции', unit: 'мин', digits: 0 },
      ],
    },
  },
  shot: {
    id: 'shot',
    tab: 'Расход дроби',
    hash: 'drob',
    title: 'Калькулятор расхода дроби',
    equipment: { label: 'Дробемётная установка', manual: 'Своя установка — ввести вручную' },
    catalog: { href: '/products/drobemetnoe-oborudovanie/', label: 'Дробемётное оборудование' },
    selects: [
      {
        key: 'basis',
        label: 'Программа обработки',
        options: [
          { value: 'tonne', label: 'По массе деталей, т' },
          { value: 'area', label: 'По площади, м²' },
          { value: 'hour', label: 'По времени работы, ч' },
        ],
      },
    ],
    groups: [
      {
        title: 'Обработка',
        fields: [
          { key: 'amount', label: 'Объём за период', unit: 'т', units: { select: 'basis', by: { tonne: 'т', area: 'м²', hour: 'ч' } }, value: 100, min: 0, max: 1e9 },
          {
            key: 'norm',
            label: 'Фактический расход',
            unit: 'кг/т',
            units: { select: 'basis', by: { tonne: 'кг/т', area: 'кг/м²', hour: 'кг/ч' } },
            value: 0.8,
            min: 0,
            max: 1e6,
            hint: 'Расход новой дроби на восполнение потерь по замерам, а не подача турбин.',
          },
        ],
      },
      {
        title: 'Запас и остатки',
        fields: [
          { key: 'reserve', label: 'Страховой запас', unit: '%', value: 10, min: 0, max: 100 },
          { key: 'initial', label: 'Первичная загрузка', unit: 'кг', value: 0, min: 0, max: 1e7, hint: 'Только при запуске установки или замене рабочего заряда.' },
          { key: 'stock', label: 'Остаток на складе', unit: 'кг', value: 0, min: 0, max: 1e9 },
        ],
      },
      {
        title: 'Закупка',
        fields: [
          { key: 'pack', label: 'Масса упаковки', unit: 'кг', value: 25, min: 0.001, max: 1e5 },
          { key: 'shotPrice', label: 'Цена дроби', unit: '{cur}/кг', value: 100, min: 0, max: 1e6 },
        ],
      },
    ],
    main: { key: 'purchase', label: 'Дробь к закупке', unit: 'кг' },
    note: [
      { key: 'packs', label: 'Упаковок', unit: '', digits: 0 },
      { key: 'pack', label: '×', unit: 'кг', sep: ' ' },
    ],
    metrics: [
      { key: 'use', label: 'Расход за период', unit: 'кг' },
      { key: 'reserveKg', label: 'Страховой запас', unit: 'кг' },
      { key: 'initial', label: 'Первичная загрузка', unit: 'кг' },
      { key: 'deficit', label: 'Дефицит до фасовки', unit: 'кг' },
      { key: 'cost', label: 'Стоимость закупки', unit: '{cur}', digits: 2 },
      { key: 'usedCost', label: 'Стоимость израсходованной дроби', unit: '{cur}', digits: 2 },
      { key: 'leftover', label: 'Остаток сверх страхового запаса', unit: 'кг' },
    ],
    chart: {
      title: 'Потребность за период',
      bars: [
        { key: 'use', label: 'Восполнение расхода', unit: 'кг' },
        { key: 'reserveKg', label: 'Страховой запас', unit: 'кг' },
        { key: 'initial', label: 'Первичная загрузка', unit: 'кг' },
      ],
    },
  },
  hts: {
    id: 'hts',
    tab: 'Смеси ХТС',
    hash: 'hts',
    title: 'Калькулятор ХТС',
    equipment: { label: 'Смеситель', manual: 'Свой смеситель — ввести вручную' },
    catalog: { href: '/products/linii-dlya-holodnotverdeyushhih-smesej-hts/', label: 'Оборудование ХТС' },
    selects: [],
    groups: [
      {
        title: 'Производственная программа',
        fields: [
          { key: 'rate', label: 'Подача песка', unit: 'т/ч', value: 10, min: 0.01, max: 500, hint: 'Песчаная основа без связующего и отвердителя.' },
          { key: 'hours', label: 'Работа в сутки', unit: 'ч', value: 8, min: 0.1, max: 24 },
          { key: 'days', label: 'Рабочие дни', unit: 'дн.', value: 22, min: 1, max: 366, integer: true },
          { key: 'load', label: 'Загрузка смесителя', unit: '%', value: 75, min: 0.1, max: 100, hint: 'Доля времени фактической подачи песка.' },
        ],
      },
      {
        title: 'Рецептура',
        fields: [
          { key: 'binder', label: 'Связующее к песку', unit: '%', value: 1.2, min: 0, max: 20, hint: 'Массовая доля от песчаной основы.' },
          { key: 'hardener', label: 'Отвердитель к связующему', unit: '%', value: 40, min: 0, max: 200, hint: 'По техкарте и документации поставщика.' },
        ],
      },
      {
        title: 'Стоимость материалов',
        fields: [
          { key: 'sandPrice', label: 'Свежий песок', unit: '{cur}/т', value: 1800, min: 0, max: 1e7 },
          { key: 'binderPrice', label: 'Связующее', unit: '{cur}/кг', value: 240, min: 0, max: 1e7 },
          { key: 'hardenerPrice', label: 'Отвердитель', unit: '{cur}/кг', value: 195, min: 0, max: 1e7 },
        ],
      },
      {
        title: 'Использование регенерата',
        fields: [
          { key: 'reclaim', label: 'Доля регенерата в песке', unit: '%', value: 0, min: 0, max: 100, hint: 'Допустимую долю устанавливает технолог по анализам песка.' },
          { key: 'reclaimPrice', label: 'Подготовка регенерата', unit: '{cur}/т', value: 500, min: 0, max: 1e7, hint: 'Переменные затраты на тонну готового регенерата.' },
        ],
      },
    ],
    main: { key: 'total', label: 'Бюджет материалов', unit: '{cur} / период', digits: 0 },
    note: [
      { key: 'days', label: 'Рабочих дней', unit: '', digits: 0 },
      { key: 'sand', label: 'песчаная основа', unit: 'т' },
    ],
    metrics: [
      { key: 'mixture', label: 'Готовая смесь', unit: 'т' },
      { key: 'perMixture', label: 'Стоимость тонны смеси', unit: '{cur}/т', digits: 1 },
      { key: 'binderKg', label: 'Связующее', unit: 'кг', digits: 1 },
      { key: 'hardenerKg', label: 'Отвердитель', unit: 'кг', digits: 1 },
      { key: 'saving', label: 'Разница к полностью свежему песку', unit: '{cur}', digits: 0 },
    ],
    chart: {
      title: 'Состав бюджета',
      bars: [
        { key: 'costFresh', label: 'Свежий песок', unit: '{cur}', digits: 0 },
        { key: 'costReclaim', label: 'Подготовка регенерата', unit: '{cur}', digits: 0 },
        { key: 'costBinder', label: 'Связующее', unit: '{cur}', digits: 0 },
        { key: 'costHardener', label: 'Отвердитель', unit: '{cur}', digits: 0 },
      ],
    },
  },
};

/** Поля, которые участвуют в расчёте при текущих выборах. */
export function activeFields(def: CalcDef, values: CalcValues): CalcField[] {
  return def.groups.flatMap((g) => g.fields).filter((f) => !f.when || values[f.when.select] === f.when.is);
}

/** Пример: значения полей и первые варианты выборов; examples — свои значения примера (цены, тариф). */
export function exampleValues(def: CalcDef, examples: Partial<Record<string, number>> = {}): CalcValues {
  const out: CalcValues = {};
  for (const s of def.selects) out[s.key] = s.options[0]!.value;
  for (const f of def.groups.flatMap((g) => g.fields)) out[f.key] = examples[f.key] ?? f.value;
  return out;
}

export type CalcErrors = Record<string, string>;
export type CalcResult = { ok: true; values: Record<string, number> } | { ok: false; errors: CalcErrors };

/** Ошибки ввода: число в диапазоне (у целых полей — целое), выбор — из вариантов. Пусто — можно считать. */
export function validate(def: CalcDef, values: CalcValues): CalcErrors {
  const errors: CalcErrors = {};
  for (const s of def.selects) if (!s.options.some((o) => o.value === values[s.key])) errors[s.key] = 'Выберите вариант';
  for (const f of activeFields(def, values)) {
    const v = values[f.key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < f.min || v > f.max) errors[f.key] = 'range';
    else if (f.integer && !Number.isInteger(v)) errors[f.key] = 'integer';
  }
  return errors;
}

const num = (values: CalcValues, key: string) => values[key] as number;

function melt(v: CalcValues): Record<string, number> {
  const mass = num(v, 'mass');
  const energy = v.mode === 'thermal' ? (mass * num(v, 'heat')) / (num(v, 'efficiency') / 100) : mass * num(v, 'specific');
  const avgPower = (num(v, 'power') * num(v, 'powerLoad')) / 100;
  const meltMin = (energy / avgPower) * 60;
  const extra = num(v, 'extra');
  const cycle = meltMin + extra;
  const cycleEnergy = energy + (num(v, 'extraPower') * extra) / 60;
  const liquid = (mass * num(v, 'yield')) / 100;
  // целые циклы: доля ниже 1e-9 — погрешность деления (480 / 60 — ровно 8)
  const cycles = Math.floor((num(v, 'shift') * 60) / cycle + 1e-9);
  return {
    energy,
    avgPower,
    meltMin,
    extra,
    cycle,
    cycleEnergy,
    cost: cycleEnergy * num(v, 'tariff'),
    liquid,
    rate: (liquid * 60) / cycle,
    cycles,
    shiftOutput: cycles * liquid,
  };
}

function shot(v: CalcValues): Record<string, number> {
  const use = num(v, 'amount') * num(v, 'norm');
  const reserveKg = (use * num(v, 'reserve')) / 100;
  const initial = num(v, 'initial');
  const need = use + reserveKg + initial;
  const deficit = Math.max(0, need - num(v, 'stock'));
  const pack = num(v, 'pack');
  const q = deficit / pack;
  // ровно целое число упаковок — без лишней из-за погрешности деления
  const packs = Math.abs(q - Math.round(q)) < 1e-10 ? Math.round(q) : Math.ceil(q);
  const purchase = packs * pack;
  const price = num(v, 'shotPrice');
  return {
    use,
    reserveKg,
    initial,
    need,
    deficit,
    packs,
    pack,
    purchase,
    cost: purchase * price,
    usedCost: use * price,
    leftover: num(v, 'stock') + purchase - need,
  };
}

function hts(v: CalcValues): Record<string, number> {
  const sand = (num(v, 'rate') * num(v, 'hours') * num(v, 'days') * num(v, 'load')) / 100;
  const binderKg = (sand * 1000 * num(v, 'binder')) / 100;
  const hardenerKg = (binderKg * num(v, 'hardener')) / 100;
  const fresh = sand * (1 - num(v, 'reclaim') / 100);
  const reclaimed = (sand * num(v, 'reclaim')) / 100;
  const costFresh = fresh * num(v, 'sandPrice');
  const costReclaim = reclaimed * num(v, 'reclaimPrice');
  const costBinder = binderKg * num(v, 'binderPrice');
  const costHardener = hardenerKg * num(v, 'hardenerPrice');
  const total = costFresh + costReclaim + costBinder + costHardener;
  const mixture = sand + (binderKg + hardenerKg) / 1000;
  return {
    sand,
    days: num(v, 'days'),
    binderKg,
    hardenerKg,
    fresh,
    reclaimed,
    costFresh,
    costReclaim,
    costBinder,
    costHardener,
    total,
    mixture,
    perMixture: mixture ? total / mixture : 0,
    perSand: sand ? total / sand : 0,
    // та же рецептура, весь песок свежий: положительное — экономия на регенерате
    saving: sand * num(v, 'sandPrice') + costBinder + costHardener - total,
  };
}

const FORMULAS: Record<CalcId, (v: CalcValues) => Record<string, number>> = { melt, shot, hts };

/** Расчёт: при ошибке ввода — только ошибки, результата нет. */
export function calculate(id: CalcId, values: CalcValues): CalcResult {
  const def = CALCULATORS[id];
  const errors = validate(def, values);
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, values: FORMULAS[id](values) };
}

/** Единица с валютой блока. */
export const withCurrency = (unit: string, currency: string) => unit.replace('{cur}', currency);

/** Число для показа: разряды и запятая по языку страницы (ru, kk, en), не больше digits знаков после запятой. */
export function formatNumber(value: number, digits = 3, lang = 'ru'): string {
  return new Intl.NumberFormat(lang, { maximumFractionDigits: digits }).format(Math.abs(value) < 1e-12 ? 0 : value);
}
