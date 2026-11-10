/**
 * Модели для «Калькуляторов расчёта»: плавка, расход дроби, смеси ХТС. Выбор модели подставляет её паспортные
 * значения в поля калькулятора. Источники: индекс «Сравнения товаров» (характеристики карточек печей и дробемётов,
 * compare.ts) и таблицы моделей на страницах смесителей ХТС (одна страница — несколько моделей).
 * В список идёт только надёжно прочитанное; модель без главного значения не попадает — она в отчёте
 * (calculatorEquipmentReport) с причиной.
 */
import { compareWalkOrder, type CompareItem, type CompareSection } from './compare.ts';
import { htmlToText } from './html.ts';

/** Сплав для удельного расхода электроэнергии печи. */
export type MeltAlloy = 'iron' | 'steel' | 'aluminum' | 'copper';

export interface CalcEquipment {
  /** модель, как в каталоге: «УИ-0.15Т-160» */
  name: string;
  /** страница товара */
  url: string;
  /** группа в выборе: подпись раздела каталога («Для стали и чугуна», «Кранового типа», «Смесители ХТС»…) */
  group: string;
  /** значения полей калькулятора, которые подставляет выбор модели (только те, что удалось надёжно прочитать) */
  values: Record<string, number>;
  /** плавка: удельный расход электроэнергии, кВт·ч/т шихты, по сплавам — из «Нижний ориентир удельного расхода» */
  specific?: Partial<Record<MeltAlloy, number>>;
  /** сплав по умолчанию для модели (по разделу каталога) */
  alloy?: MeltAlloy;
  /** выборы калькулятора, которые ставит модель: { basis: 'area' } — норма расхода дроби на м² */
  selects?: Record<string, string>;
  /** 1–3 короткие строки паспорта для подсказки под выбором: «Турбины: 2 × 15 кВт», «Подача дроби: 2 × 250 кг/мин» */
  facts: string[];
}
export interface CalculatorEquipment {
  melt: CalcEquipment[];
  shot: CalcEquipment[];
  hts: CalcEquipment[];
}

export interface CalculatorEquipmentInput {
  /** `index.sections` из buildCompareIndex (compare-index.json): скрытые разделы туда уже не попали */
  sections: Record<string, Pick<CompareSection, 'title'> & { items: Pick<CompareItem, 'url' | 'name' | 'specs'>[] }>;
  /** страницы смесителей ХТС (адрес начинается с HTS_MIXERS) с HTML тела; прочие страницы не читаются */
  pages: { path: string; html: string }[];
}

/** Покрытие одного калькулятора. */
export interface CalcCoverage {
  /** моделей в списке */
  included: number;
  /** сколько моделей списка получили поле калькулятора: { mass: 56, power: 56, specific: 42 } */
  filled: Record<string, number>;
  /** не вошли в список */
  skipped: { name: string; url: string; reason: string }[];
}
export type CalculatorEquipmentReport = Record<keyof CalculatorEquipment, CalcCoverage>;

const MELT_PREFIX = '/products/induktsionnye-plavilnye-pechi/';
const SHOT_PREFIX = '/products/drobemetnoe-oborudovanie/';
/** Начало адресов страниц смесителей ХТС: smesiteli/, smesiteli-chashechnye/, -dvuhrukavnye/, -peredvizhnye/. */
export const HTS_MIXERS = '/products/linii-dlya-holodnotverdeyushhih-smesej-hts/smesiteli';

/**
 * Разделы печей и сплав по умолчанию, порядок — как в каталоге. Транзисторные — медь: загрузка меди указана у всех
 * 14 моделей (у УИ-1П…УИ-10П — расчётная, основной металл у них золото), стали — у 10, чугуна — у 8; базовый тигель
 * УИ-15П…УИ-160П — карбидокремниевый для меди. Новый раздел — сплав по первому металлу в его подписи.
 */
const MELT: Record<string, MeltAlloy> = {
  '/products/induktsionnye-plavilnye-pechi/po-stali/': 'iron',
  '/products/induktsionnye-plavilnye-pechi/po-medi/': 'copper',
  '/products/induktsionnye-plavilnye-pechi/po-alyuminiyu/': 'aluminum',
  '/products/induktsionnye-plavilnye-pechi/tranzistornye/': 'copper',
};

/** Металлы в тексте → сплав калькулятора; латунь и бронза считаются по меди, силумин — по алюминию, золото — нет. */
const ALLOY_WORDS: [MeltAlloy, RegExp][] = [
  ['iron', /чугун/i],
  ['steel', /(?<![а-яё])стал(?:ь(?!н)|и)/i],
  ['aluminum', /алюмин|силумин/i],
  ['copper', /(?<![а-яё])(?:мед[ьин]|латун|бронз)/i],
];
const alloysIn = (s: string): MeltAlloy[] => ALLOY_WORDS.filter(([, re]) => re.test(s)).map(([a]) => a);

/** Число: разряды через пробел («10 000»), дробная часть через запятую или точку. */
const NUM = String.raw`\d{1,3}(?: \d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?`;
/** Число или диапазон «200–300», «0,5 – 2,0». */
const FIGURE = new RegExp(`(${NUM})(?:\\s*[–—‒-]\\s*(${NUM}))?`);
const FIGURES = new RegExp(FIGURE.source, 'g');

/** Узкие, неразрывные и прочие пробелы — в обычный, невидимые символы — прочь. */
const plain = (s: string) => s.replace(/[\u00A0\u202F\u2009\u2007\u2002\u2003]/g, ' ').replace(/[\u2060\u200B\u00AD]/g, '');
const toNumber = (s: string) => Number(s.replace(/ /g, '').replace(',', '.'));

export interface RuNumber {
  min: number;
  max: number;
}

function figure(m: RegExpMatchArray): RuNumber {
  const a = toNumber(m[1]);
  const b = m[2] === undefined ? a : toNumber(m[2]);
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

/**
 * Первое число в записи по-русски: «1 500», «0,35», «≈ 262», «до 1 500», «от 550», «≤ 100», «300; в поставку
 * не входит». Диапазон («200–300», «0,5 – 2,0») — { min, max }, у одного числа они равны; числа нет — null.
 */
export function parseRuNumber(text: string): RuNumber | null {
  const m = FIGURE.exec(plain(text));
  return m ? figure(m) : null;
}

const low = (s: string | undefined) => (s === undefined ? undefined : parseRuNumber(s)?.min);
const high = (s: string | undefined) => (s === undefined ? undefined : parseRuNumber(s)?.max);

/**
 * Числа по сплавам: «от 550 кВт·ч/т для чугуна; от 620 кВт·ч/т для стали» (число перед металлом — одно на часть),
 * «сталь и чугун 100 кг; медь до 6,80 кг и алюминий до 2,00 кг» (металл перед числом — каждому своё).
 */
function byAlloy(text: string | undefined): Partial<Record<MeltAlloy, RuNumber>> {
  const out: Partial<Record<MeltAlloy, RuNumber>> = {};
  const put = (part: string, value: RuNumber) => {
    for (const a of alloysIn(part)) out[a] ??= value;
  };
  for (const part of plain(text ?? '').split(';')) {
    const figures = [...part.matchAll(FIGURES)];
    if (!figures.length) continue;
    if (!alloysIn(part.slice(0, figures[0].index)).length) {
      put(part, figure(figures[0]));
      continue;
    }
    let from = 0;
    for (const f of figures) {
      put(part.slice(from, f.index), figure(f));
      from = f.index + f[0].length;
    }
  }
  return out;
}

/** Единица из подписи («Подача дроби, кг/мин» → «кг/мин»). */
const unitOf = (label: string) => /,\s*([^,\s]+)$/.exec(label)?.[1] ?? '';
/** Значение с единицей: «4 × 250» → «4 × 250 кг/мин», «300; в поставку не входит» → «300 кг; в поставку не входит». */
const withUnit = (value: string, unit: string) => (!unit || value.includes(unit) ? value : value.replace(/^([^;(]*\d)/, `$1 ${unit}`));

type Specs = Record<string, string>;

/** Строки паспорта: [поле карточки, подпись]; по одной на подпись, не больше трёх. */
function facts(specs: Specs, rules: [RegExp, string][]): string[] {
  const out = new Map<string, string>();
  for (const [re, title] of rules) {
    if (out.size >= 3 || out.has(title)) continue;
    const hit = Object.entries(specs).find(([label]) => re.test(label));
    if (hit) out.set(title, `${title}: ${withUnit(hit[1], unitOf(hit[0]))}`);
  }
  return [...out.values()];
}

const MELT_FACTS: [RegExp, string][] = [
  [/^Загрузка по металлу$/, 'Загрузка'],
  [/^Нижний ориентир удельного расхода$/, 'Удельный расход'],
  [/^Плавильные материалы$/, 'Материалы'],
  [/^КПД установки/, 'КПД'],
  [/^Режим работы$/, 'Режим работы'],
];

const SHOT_FACTS: [RegExp, string][] = [
  [/^Турбины: количество × мощность двигателя/, 'Турбины'],
  [/^Турбина — мощность/, 'Турбина'],
  [/подача дроби/, 'Подача дроби'],
  [/^Количество турбин(, шт\.)?$/, 'Турбины'],
  [/^Ориентировочный расход абразива/, 'Расход абразива'],
  [/^Ориентировочно по стали/, 'Очистка стали'],
  [/^Первоначальная загрузка дроби/, 'Загрузка дроби'],
  [/^Разовая загрузка камеры очистки/, 'Загрузка деталей'],
  [/^Грузоподъёмность стола/, 'Грузоподъёмность стола'],
  [/^Обычная продолжительность обработки/, 'Цикл очистки'],
];

const ALLOY_RU: Record<MeltAlloy, string> = { iron: 'чугун', steel: 'сталь', aluminum: 'алюминий', copper: 'медь' };

/** Килограммы → тонны, до грамма. */
const tonnes = (kg: number) => Math.round(kg * 1000) / 1e6;

/**
 * Масса плавки по сплаву, т: «Номинальная масса одной плавки по …», «Загрузка по металлу» (транзисторные),
 * «Загрузка стали, кг», «Расчётная вместимость меди при 95%, кг», общая «Масса загрузки плавильного узла, кг».
 * «Теоретическая вместимость … до края» — объём тигля, не загрузка.
 */
function meltMass(specs: Specs, alloy: MeltAlloy): number | undefined {
  const named = (re: RegExp) => Object.entries(specs).find(([label]) => re.test(label) && alloysIn(label).includes(alloy))?.[1];
  const kg =
    high(named(/^Номинальная масса одной плавки по .+, кг$/)) ??
    byAlloy(specs['Загрузка по металлу'])[alloy]?.max ??
    high(named(/^(?:Загрузка \S+|Расчётная вместимость .+), кг$/)) ??
    high(specs['Масса загрузки плавильного узла, кг']);
  return kg === undefined ? undefined : tonnes(kg);
}

type Sections = CalculatorEquipmentInput['sections'];
type Built = { items: CalcEquipment[]; skipped: CalcCoverage['skipped'] };

/** Разделы с адресом на prefix: известные — в порядке списка, остальные — как в индексе. */
function sectionsOf(sections: Sections, prefix: string, known: string[] = []): string[] {
  const rank = (url: string) => (known.includes(url) ? known.indexOf(url) : known.length);
  return Object.keys(sections)
    .filter((url) => url.startsWith(prefix))
    .sort((a, b) => rank(a) - rank(b));
}

function meltList(sections: Sections): Built {
  const out: Built = { items: [], skipped: [] };
  for (const url of sectionsOf(sections, MELT_PREFIX, Object.keys(MELT))) {
    const sec = sections[url];
    const alloy = MELT[url] ?? alloysIn(sec.title)[0];
    const group: CalcEquipment[] = [];
    for (const it of sec.items) {
      const skip = (reason: string) => out.skipped.push({ name: it.name, url: it.url, reason });
      if (!alloy) {
        skip('сплав раздела не определён');
        continue;
      }
      const mass = meltMass(it.specs, alloy);
      const power = high(it.specs['Номинальная мощность ТПЧ, кВт'] ?? it.specs['Мощность установки, кВт'] ?? it.specs['Расчётная потребляемая мощность, кВт']);
      if (mass === undefined) {
        skip(`нет массы плавки (${ALLOY_RU[alloy]})`);
        continue;
      }
      if (power === undefined) {
        skip('нет мощности');
        continue;
      }
      const values: Record<string, number> = { mass, power };
      const specific: Partial<Record<MeltAlloy, number>> = {};
      for (const [a, v] of Object.entries(byAlloy(it.specs['Нижний ориентир удельного расхода']))) specific[a as MeltAlloy] = v.min;
      if (specific[alloy] !== undefined) values.specific = specific[alloy];
      // КПД — число или нижняя граница диапазона; «до 95» — только верхняя граница (у УИ-2Т-1600), её место — в подсказке
      const kpd = it.specs['КПД установки, %'];
      const efficiency = kpd && !/^\s*(?:до|≤|<|не более)/i.test(kpd) ? low(kpd) : undefined;
      if (efficiency !== undefined) values.efficiency = efficiency;
      group.push({
        name: it.name,
        url: it.url,
        group: sec.title,
        values,
        ...(Object.keys(specific).length ? { specific } : {}),
        alloy,
        facts: facts(it.specs, MELT_FACTS),
      });
    }
    out.items.push(...group.sort((a, b) => a.values.mass - b.values.mass || a.values.power - b.values.power));
  }
  return out;
}

/**
 * Дробемёты входят все; первоначальная загрузка дроби — только где она указана. Нормы расхода на тонну или час
 * в карточках нет (подача турбин — оборот дроби, не расход); у передвижных — «≤ 100 г/м²»: норма 0,1 кг/м²,
 * программа — по площади.
 */
function shotList(sections: Sections): Built {
  const out: Built = { items: [], skipped: [] };
  for (const url of sectionsOf(sections, SHOT_PREFIX)) {
    const sec = sections[url];
    const group = sec.items.map((it): CalcEquipment => {
      const values: Record<string, number> = {};
      const initial = high(it.specs['Первоначальная загрузка дроби, кг']);
      if (initial !== undefined) values.initial = initial;
      // передвижные: расход абразива на м² — норма расхода, программа — по площади
      const perArea = high(it.specs['Ориентировочный расход абразива, г/м²']);
      if (perArea !== undefined) values.norm = perArea / 1000;
      return {
        name: it.name,
        url: it.url,
        group: sec.title,
        values,
        ...(perArea !== undefined ? { selects: { basis: 'area' } } : {}),
        facts: facts(it.specs, SHOT_FACTS),
      };
    });
    out.items.push(...group.sort((a, b) => a.name.localeCompare(b.name, 'ru', { numeric: true })));
  }
  return out;
}

/** Таблицы моделей: строка заголовка начинается с «Модель», ниже — по модели в строке. */
function modelTables(html: string): { head: string[]; rows: string[][] }[] {
  const out: { head: string[]; rows: string[][] }[] = [];
  for (const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const rows = [...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((tr) =>
      [...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => htmlToText(cell[1])),
    );
    const at = rows.findIndex((r) => /^модель$/i.test(r[0] ?? ''));
    if (at >= 0) out.push({ head: rows[at], rows: rows.slice(at + 1) });
  }
  return out;
}

/** Подпись группы: текущая крошка («Смесители непрерывного действия»), иначе H1. */
function pageTitle(html: string): string {
  const pick = (re: RegExp) => htmlToText(re.exec(html)?.[1] ?? '');
  return pick(/<span[^>]*class="breadcrumb__current"[^>]*>([\s\S]*?)<\/span>/i) || pick(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || 'Смесители ХТС';
}

/** Смесители ХТС: модель — строка таблицы, производительность — столбец «Произв…» в т/ч (у диапазона — верхняя). */
function htsList(pages: CalculatorEquipmentInput['pages']): Built {
  const out: Built = { items: [], skipped: [] };
  const seen = new Set<string>();
  const mixers = pages.filter((p) => p.path.startsWith(HTS_MIXERS)).sort((a, b) => compareWalkOrder(a.path, b.path));
  for (const page of mixers) {
    const group = pageTitle(page.html);
    const tables = modelTables(page.html);
    if (!tables.length) out.skipped.push({ name: group, url: page.path, reason: 'нет таблицы моделей' });
    for (const { head, rows } of tables) {
      const col = head.findIndex((h) => /^произв/i.test(h));
      for (const row of rows) {
        const name = row[0];
        if (!name) continue;
        const skip = (reason: string) => out.skipped.push({ name, url: page.path, reason });
        if (seen.has(name)) {
          skip('модель уже в списке');
          continue;
        }
        const cell = col < 0 ? '' : (row[col] ?? '');
        const rate = /т\/ч/.test(`${head[col] ?? ''} ${cell}`) ? high(cell) : undefined;
        if (rate === undefined) {
          skip('нет производительности, т/ч');
          continue;
        }
        seen.add(name);
        const rest = head
          .map((label, i) => ({ label, value: row[i] ?? '' }))
          .filter(({ value }, i) => i > 0 && i !== col && value && !/уточня/i.test(value))
          .slice(0, 3)
          .map(({ label, value }) => `${label.replace(/,\s*[^,\s]+$/, '')}: ${withUnit(value, unitOf(label))}`);
        out.items.push({ name, url: page.path, group, values: { rate }, facts: rest });
      }
    }
  }
  return out;
}

function coverage({ items, skipped }: Built): CalcCoverage {
  const filled: Record<string, number> = {};
  for (const it of items) for (const key of Object.keys(it.values)) filled[key] = (filled[key] ?? 0) + 1;
  return { included: items.length, filled, skipped };
}

function collect(input: CalculatorEquipmentInput): Record<keyof CalculatorEquipment, Built> {
  return { melt: meltList(input.sections), shot: shotList(input.sections), hts: htsList(input.pages) };
}

/** Списки моделей для калькуляторов плавки, расхода дроби и ХТС. */
export function buildCalculatorEquipment(input: CalculatorEquipmentInput): CalculatorEquipment {
  const { melt, shot, hts } = collect(input);
  return { melt: melt.items, shot: shot.items, hts: hts.items };
}

/** Покрытие: сколько моделей вошло, какие поля заполнены, кто не вошёл и почему. */
export function calculatorEquipmentReport(input: CalculatorEquipmentInput): CalculatorEquipmentReport {
  const { melt, shot, hts } = collect(input);
  return { melt: coverage(melt), shot: coverage(shot), hts: coverage(hts) };
}
