import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  buildCalculatorEquipment,
  calculatorEquipmentReport,
  parseRuNumber,
  type CalcEquipment,
  type CalculatorEquipmentInput,
} from './calculator-equipment.ts';

// выдержки из боевых данных 10.11.2026: разделы compare-index.json и таблицы страниц смесителей ХТС
const fixture = (name: string) => readFileSync(new URL(`./fixtures/calculator-equipment/${name}`, import.meta.url), 'utf8');
const sections = JSON.parse(fixture('sections.json')) as CalculatorEquipmentInput['sections'];
const HTS = '/products/linii-dlya-holodnotverdeyushhih-smesej-hts/';
const pages = ['smesiteli-chashechnye', 'smesiteli', 'smesiteli-dvuhrukavnye'].map((slug) => ({ path: `${HTS}${slug}/`, html: fixture(`${slug}.html`) }));

const eq = buildCalculatorEquipment({ sections, pages });
const byName = (list: CalcEquipment[]) => Object.fromEntries(list.map((e) => [e.name, e]));
const melt = byName(eq.melt);
const shot = byName(eq.shot);
const hts = byName(eq.hts);

test('числа по-русски: разряды, запятая, «до», «от», «≈», диапазон', () => {
  assert.deepEqual(parseRuNumber('до 1 500'), { min: 1500, max: 1500 });
  assert.deepEqual(parseRuNumber('200–300'), { min: 200, max: 300 });
  assert.deepEqual(parseRuNumber('0,35'), { min: 0.35, max: 0.35 });
  assert.deepEqual(parseRuNumber('≈ 262'), { min: 262, max: 262 });
  assert.deepEqual(parseRuNumber('0,5 – 2,0'), { min: 0.5, max: 2 });
  assert.deepEqual(parseRuNumber('10\u00A0000'), { min: 10000, max: 10000 }, 'неразрывный пробел в разрядах');
  assert.deepEqual(parseRuNumber('1\u202F200 кВт'), { min: 1200, max: 1200 }, 'узкий неразрывный пробел');
  assert.deepEqual(parseRuNumber('300; в поставку не входит'), { min: 300, max: 300 });
  assert.deepEqual(parseRuNumber('от 550 кВт·ч/т для чугуна; от 620 кВт·ч/т для стали'), { min: 550, max: 550 });
  assert.equal(parseRuNumber('уточняется'), null);
});

test('печь по стали и чугуну: масса в тоннах, мощность ТПЧ, удельный расход по сплавам, по умолчанию чугун', () => {
  assert.deepEqual(melt['УИ-0.15Т-160'], {
    name: 'УИ-0.15Т-160',
    url: '/products/induktsionnye-plavilnye-pechi/po-stali/ui-0-15t-160/',
    group: 'Для стали и чугуна',
    values: { mass: 0.15, power: 160, specific: 550 },
    specific: { iron: 550, steel: 620 },
    alloy: 'iron',
    facts: ['Удельный расход: от 550 кВт·ч/т для чугуна; от 620 кВт·ч/т для стали', 'Материалы: сталь, чугун'],
  });
});

test('УИ-2Т-1600: масса загрузки узла, мощность установки; КПД «до 95» — верхняя граница, только в подсказке', () => {
  const it = melt['УИ-2Т-1600'];
  assert.deepEqual(it.values, { mass: 2, power: 1600 });
  assert.equal(it.specific, undefined, 'удельного расхода в карточке нет');
  assert.deepEqual(it.facts, ['Материалы: сталь / чугун', 'КПД: до 95 %', 'Режим работы: до 3-сменного']);
  const range = buildCalculatorEquipment({
    sections: {
      '/products/induktsionnye-plavilnye-pechi/po-stali/': {
        title: 'Для стали и чугуна',
        items: [{ url: '/products/induktsionnye-plavilnye-pechi/po-stali/ui-1t/', name: 'УИ-1Т', specs: { 'Масса загрузки плавильного узла, кг': '1000', 'Мощность установки, кВт': '800', 'КПД установки, %': '70–75' } }],
      },
    },
    pages: [],
  });
  assert.deepEqual(range.melt[0].values, { mass: 1, power: 800, efficiency: 70 }, 'диапазон КПД — нижняя граница');
});

test('печи для алюминия и для меди: свой сплав, масса по нему; латунь «по режиму» числа не даёт', () => {
  const al = melt['УИ-0.5Т-250А'];
  assert.deepEqual([al.group, al.alloy, al.values, al.specific], ['Для алюминия', 'aluminum', { mass: 0.5, power: 250, specific: 500 }, { aluminum: 500 }]);
  const cu = melt['УИ-1Т-600М'];
  assert.deepEqual([cu.group, cu.alloy, cu.values, cu.specific], ['Для меди, латуни и бронзы', 'copper', { mass: 1, power: 600, specific: 300 }, { copper: 300 }]);
});

test('транзисторные: медь по умолчанию, масса — загрузка меди, мощность расчётная; загрузки по металлам — в подсказке', () => {
  const big = melt['УИ-160П'];
  assert.equal(big.alloy, 'copper');
  assert.deepEqual(big.values, { mass: 0.2, power: 150.06 }, 'теоретическая вместимость по стали до края — не загрузка');
  assert.equal(big.specific, undefined);
  assert.deepEqual(big.facts, ['Загрузка: сталь и чугун 100 кг; медь 200 кг; алюминий 66 кг']);
  assert.deepEqual(melt['УИ-10П'].values, { mass: 0.0068, power: 42.96 }, 'малая серия: медь «до 6,80 кг (расчёт)», не золото 8–10 кг');
});

test('печи: разделы в порядке каталога, внутри — по массе плавки', () => {
  assert.deepEqual(
    eq.melt.map((e) => e.name),
    ['УИ-0.1Т-100', 'УИ-0.15Т-160', 'УИ-2Т-1600', 'УИ-1Т-600М', 'УИ-0.5Т-250А', 'УИ-10П', 'УИ-160П'],
  );
});

test('дробемёты: первоначальная загрузка дроби — где указана; турбины и подача — в подсказке', () => {
  assert.deepEqual(shot['УИД-376Е'], {
    name: 'УИД-376Е',
    url: '/products/drobemetnoe-oborudovanie/kranovogo-tipa/uid-376e/',
    group: 'Кранового типа',
    values: { initial: 300 },
    facts: ['Турбины: 2 × 7,5 кВт', 'Подача дроби: 2 × 120–125 кг/мин; суммарно 240–250 кг/мин', 'Загрузка дроби: 300 кг; в поставку не входит'],
  });
  assert.deepEqual(shot['УИД-3710'].values, {});
  assert.deepEqual(shot['УИД-3710'].facts, ['Турбины: 2 × 15 кВт', 'Цикл очистки: 7–15 мин']);
  assert.deepEqual(shot['УИД-15'].values, {}, 'разовая загрузка камеры — детали, а не дробь');
  assert.deepEqual(shot['УИД-15'].facts, ['Загрузка деталей: до 1 500 кг', 'Цикл очистки: 7–15 мин']);
  assert.deepEqual(shot['УИД-550'].facts, ['Турбины: 2 × 11 кВт', 'Расход абразива: ≤ 100 г/м²', 'Очистка стали: 80 м²/ч']);
  assert.equal(shot['УИД-550'].alloy, undefined);
  // передвижные: «≤ 100 г/м²» — норма 0,1 кг/м², программа — по площади
  assert.deepEqual(shot['УИД-550'].values, { norm: 0.1 });
  assert.deepEqual(shot['УИД-550'].selects, { basis: 'area' });
});

test('смесители ХТС: модель — строка таблицы, производительность в т/ч, у диапазона — верхняя; группа — по странице', () => {
  assert.deepEqual(hts['УИШС-243'], {
    name: 'УИШС-243',
    url: `${HTS}smesiteli/`,
    group: 'Смесители непрерывного действия',
    values: { rate: 3 },
    facts: ['Радиус поворота: 1380 мм', 'Ø смесит. узла: 175 мм', 'Привод: 3 кВт; 960 об/мин'],
  });
  assert.deepEqual(hts['УИШС-245'].facts, ['Радиус поворота: 2000 мм', 'Привод: 4 кВт; 960 об/мин'], '«уточняется» не показываем');
  assert.deepEqual(hts['УИ-ХТС-МЧ-02'].values, { rate: 2 }, '«2 т/ч» в ячейке');
  assert.equal(hts['УИ-ХТС-МЧ-02'].group, 'Чашечные смесители периодического действия');
  assert.deepEqual(hts['УИ-ХТС-МД-05'].values, { rate: 5 }, '«3–5» — верхняя, как в обозначении модели');
  assert.deepEqual(
    [...new Set(eq.hts.map((e) => e.group))],
    ['Смесители непрерывного действия', 'Чашечные смесители периодического действия', 'Двухрукавные смесители непрерывного действия'],
  );
});

test('отчёт: кто не вошёл и почему, сколько полей заполнено; чужие разделы и страницы не читаются', () => {
  const steel = sections['/products/induktsionnye-plavilnye-pechi/po-stali/'];
  const input: CalculatorEquipmentInput = {
    sections: {
      ...sections,
      '/products/induktsionnye-plavilnye-pechi/po-stali/': {
        ...steel,
        items: [
          ...steel.items,
          { url: '/products/induktsionnye-plavilnye-pechi/po-stali/bez-moshchnosti/', name: 'УИ-Без-мощности', specs: { 'Номинальная масса одной плавки по стали/чугуну, кг': '150' } },
          { url: '/products/induktsionnye-plavilnye-pechi/po-stali/bez-massy/', name: 'УИ-Без-массы', specs: { 'Номинальная мощность ТПЧ, кВт': '160' } },
        ],
      },
      '/products/drobemetnoe-oborudovanie/novye/': {
        title: 'Новые',
        items: [{ url: '/products/drobemetnoe-oborudovanie/novye/uid-1/', name: 'УИД-1', specs: { 'Первоначальная загрузка дроби, кг': '200–300' } }],
      },
      '/products/sistemy-ohlazhdeniya/chillery/': {
        title: 'Чиллеры',
        items: [{ url: '/products/sistemy-ohlazhdeniya/chillery/ch-1/', name: 'Чиллер', specs: { 'Мощность установки, кВт': '10' } }],
      },
    },
    pages: [
      ...pages,
      { path: `${HTS}smesiteli-novye/`, html: '<h1>Новые смесители</h1><table><tr><th>Модель</th><th>Произв., т/ч</th></tr><tr><th>УИ-ХТС-Н</th><td>уточняется</td></tr></table>' },
      { path: `${HTS}smesiteli-bez-tablicy/`, html: '<h1>Смесители без таблицы</h1><p>Текст</p>' },
      { path: `${HTS}vibrostol/`, html: '<table><tr><th>Модель</th><th>Произв., т/ч</th></tr><tr><th>Вибростол</th><td>5</td></tr></table>' },
    ],
  };
  const report = calculatorEquipmentReport(input);
  console.log(JSON.stringify(report, null, 2));

  assert.equal(report.melt.included, 7);
  assert.deepEqual(report.melt.filled, { mass: 7, power: 7, specific: 4 });
  assert.deepEqual(
    report.melt.skipped.map((s) => [s.name, s.reason]),
    [
      ['УИ-Без-мощности', 'нет мощности'],
      ['УИ-Без-массы', 'нет массы плавки (чугун)'],
    ],
  );
  assert.equal(report.shot.included, 5, 'дробемёты входят и без загрузки дроби');
  assert.deepEqual(report.shot.filled, { initial: 2, norm: 1 });
  assert.equal(buildCalculatorEquipment(input).shot.find((e) => e.name === 'УИД-1')?.values.initial, 300, '«200–300» — верхняя');
  assert.equal(report.hts.included, 5);
  assert.deepEqual(report.hts.skipped, [
    { name: 'Смесители без таблицы', url: `${HTS}smesiteli-bez-tablicy/`, reason: 'нет таблицы моделей' },
    { name: 'УИ-ХТС-Н', url: `${HTS}smesiteli-novye/`, reason: 'нет производительности, т/ч' },
  ]);
});
