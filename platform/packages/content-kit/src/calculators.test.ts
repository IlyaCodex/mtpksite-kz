import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeFields, calculate, CALCULATORS, exampleValues, type CalcResult, type CalcValues } from './calculators.ts';

const close = (a: number | undefined, b: number) => assert.ok(a !== undefined && Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const ok = (r: CalcResult) => {
  assert.ok(r.ok, JSON.stringify(r));
  return r.values;
};

test('плавка: пример подрядчика (превью) — цикл 65 мин, 612,5 кВт·ч, 7 циклов, 6,79 т за смену', () => {
  const r = ok(calculate('melt', exampleValues(CALCULATORS.melt)));
  close(r.meltMin, 50);
  close(r.cycle, 65);
  close(r.cycleEnergy, 612.5);
  close(r.cost, 4287.5);
  close(r.liquid, 0.97);
  close(r.cycles, 7);
  close(r.shiftOutput, 6.79);
  assert.equal(r.rate!.toFixed(3), '0.895');
});

test('плавка: проверки подрядчика — режимы, целые циклы, выход металла', () => {
  const m: CalcValues = { alloy: 'iron', mode: 'measured', mass: 1, power: 800, powerLoad: 100, yield: 100, specific: 600, heat: 400, efficiency: 70, extra: 15, extraPower: 40, tariff: 7, shift: 8 };
  let r = ok(calculate('melt', m));
  close(r.energy, 600);
  close(r.meltMin, 45);
  close(r.cycle, 60);
  close(r.cycleEnergy, 610);
  close(r.cost, 4270);
  close(r.cycles, 8);
  close(r.shiftOutput, 8);
  close(r.rate, 1);
  close(ok(calculate('melt', { ...m, mode: 'thermal', heat: 420, efficiency: 70 })).energy, 600);
  r = ok(calculate('melt', { ...m, specific: 1200 }));
  close(r.meltMin, 90);
  close(r.cycles, 4);
  close(ok(calculate('melt', { ...m, shift: 0.5 })).cycles, 0);
  r = ok(calculate('melt', { ...m, yield: 50 }));
  close(r.liquid, 0.5);
  close(r.rate, 0.5);
});

test('ХТС: проверки подрядчика — бюджет, регенерат, нулевые цены', () => {
  const h: CalcValues = { rate: 10, hours: 8, days: 22, load: 100, binder: 1.2, hardener: 40, sandPrice: 1800, binderPrice: 240, hardenerPrice: 195, reclaim: 0, reclaimPrice: 500 };
  let r = ok(calculate('hts', h));
  close(r.sand, 1760);
  close(r.binderKg, 21120);
  close(r.hardenerKg, 8448);
  close(r.total, 9884160);
  close(r.perSand, 5616);
  close(r.mixture, 1789.568);
  r = ok(calculate('hts', { ...h, reclaim: 80 }));
  close(r.fresh, 352);
  close(r.reclaimed, 1408);
  close(r.saving, 1830400);
  close(r.costFresh! + r.costReclaim! + r.costBinder! + r.costHardener!, r.total!);
  r = ok(calculate('hts', { ...h, sandPrice: 0, binderPrice: 0, hardenerPrice: 0 }));
  close(r.total, 0);
  close(r.perMixture, 0);
  assert.ok(ok(calculate('hts', { ...h, reclaim: 100, reclaimPrice: 4000 })).saving! < 0);
  // пример на превью: загрузка 75 % — 7 413 120 за период, 5 523,2 за тонну смеси
  r = ok(calculate('hts', exampleValues(CALCULATORS.hts)));
  close(r.total, 7413120);
  assert.equal(r.perMixture!.toFixed(1), '5523.2');
});

test('дробь: пример подрядчика — 100 кг к закупке (4 упаковки), остаток сверх запаса 12 кг', () => {
  const r = ok(calculate('shot', exampleValues(CALCULATORS.shot)));
  close(r.use, 80);
  close(r.reserveKg, 8);
  close(r.deficit, 88);
  close(r.packs, 4);
  close(r.purchase, 100);
  close(r.cost, 10000);
  close(r.usedCost, 8000);
  close(r.leftover, 12);
  // ровно кратно упаковке — без лишней: 75 кг по 25 кг — 3 упаковки
  close(ok(calculate('shot', { ...exampleValues(CALCULATORS.shot), amount: 75, norm: 1, reserve: 0 })).packs, 3);
  // склад покрывает потребность — закупать нечего
  close(ok(calculate('shot', { ...exampleValues(CALCULATORS.shot), stock: 500 })).purchase, 0);
});

test('ввод: пусто, бесконечность, минус, выход за диапазон и дробные дни — без результата; поля другого режима не мешают', () => {
  for (const id of ['melt', 'shot', 'hts'] as const) {
    const base = exampleValues(CALCULATORS[id]);
    for (const f of activeFields(CALCULATORS[id], base)) {
      for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, f.min - 1, f.max + 1, '']) {
        assert.equal(calculate(id, { ...base, [f.key]: bad }).ok, false, `${id}.${f.key}: ${bad}`);
      }
    }
  }
  const h = exampleValues(CALCULATORS.hts);
  assert.equal(calculate('hts', { ...h, days: 2.5 }).ok, false);
  const m = exampleValues(CALCULATORS.melt);
  assert.equal(calculate('melt', { ...m, mode: 'bad' }).ok, false);
  assert.equal(calculate('melt', { ...m, mode: 'thermal', efficiency: 0 }).ok, false);
  // в режиме фактического расхода КПД не проверяется и не участвует
  assert.equal(calculate('melt', { ...m, efficiency: 0 }).ok, true);
});
