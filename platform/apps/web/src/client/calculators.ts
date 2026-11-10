import { calculate, CALCULATORS, formatNumber, type CalcId, type CalcValues } from '@mtpk/content-kit/calculators';
import { $, $$, reducedMotion } from './dom';
import { localized } from './i18n';

/**
 * Калькуляторы расчёта (блок calculators, разметка — packages/ui/src/blocks/Calculators.tsx; поля и формулы —
 * content-kit/calculators.ts): вкладки с адресом #plavka / #drob / #hts, пересчёт при вводе, выбор модели из каталога
 * (подставляет её паспортные значения), ошибки полей, «Вернуть пример», сохранение расчёта в .txt, печать и
 * «Обсудить расчёт с инженером» — итог расчёта в поле задачи формы заявки. Подписи берутся из разметки: на .kz они
 * уже на языке страницы. Оформление — styles/calculators.css.
 */
interface Equipment {
  name: string;
  url: string;
  values: Record<string, number>;
  specific?: Partial<Record<string, number>>;
  alloy?: string;
  selects?: Record<string, string>;
}
type State = 'example' | 'own' | 'model';

const lang = () => document.documentElement.lang || 'ru';
const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

function initPanel(panel: HTMLElement, equipment: Equipment[]) {
  const id = panel.dataset.calc as CalcId;
  const def = CALCULATORS[id];
  const form = $<HTMLFormElement>('.calc__form', panel)!;
  const model = $<HTMLSelectElement>('[data-calc-equipment]', panel);
  const facts = $('[data-calc-facts]', panel);
  let state: State = 'example';

  const read = (): CalcValues => {
    const values: CalcValues = {};
    for (const s of $$<HTMLSelectElement>('select[name]', form)) values[s.name] = s.value;
    for (const i of $$<HTMLInputElement>('input[name]', form)) values[i.name] = i.value.trim() === '' ? Number.NaN : Number(i.value);
    return values;
  };
  const input = (key: string) => $<HTMLInputElement>(`input[name="${key}"]`, form);
  const select = (key: string) => $<HTMLSelectElement>(`select[name="${key}"]`, form);
  const chosen = () => (model && model.value !== '' ? equipment[Number(model.value)] : undefined);
  /** поля и выборы, которые ставит хоть одна модель: у другой модели их нет — значение примера, не прошлой модели */
  const provided = [...new Set(equipment.flatMap((e) => [...Object.keys(e.values), ...Object.keys(e.selects ?? {}), ...(e.specific ? ['specific'] : [])]))];

  function showState() {
    for (const el of $$('[data-state]', panel)) el.hidden = el.dataset.state !== state;
    const name = $('[data-state="model"]', panel);
    if (name) name.textContent = chosen()?.name ?? '';
    for (const el of $$('[data-notice]', panel)) el.hidden = el.dataset.notice !== state;
  }

  function render() {
    const values = read();
    // поля и единицы по выбору: режим энергии плавки, база программы дроби
    for (const f of $$('[data-when]', form)) {
      const [select, is] = (f.dataset.when ?? '').split(':');
      f.hidden = values[select!] !== is;
    }
    for (const u of $$('[data-unit-select]', form)) {
      for (const v of $$('[data-unit-when]', u)) v.hidden = v.dataset.unitWhen !== values[u.dataset.unitSelect!];
    }
    const result = calculate(id, values);
    for (const box of $$('[data-field]', form)) {
      const bad = !result.ok && Boolean(result.errors[box.dataset.field!]);
      box.classList.toggle('is-invalid', bad);
      $('.calc__error', box)!.hidden = !bad;
      $('input', box)?.setAttribute('aria-invalid', String(bad));
    }
    panel.classList.toggle('is-invalid', !result.ok);
    $('[data-calc-invalid]', panel)!.hidden = result.ok;
    for (const out of $$<HTMLOutputElement>('output[data-out]', panel)) {
      out.textContent = result.ok ? formatNumber(result.values[out.dataset.out!] ?? 0, Number(out.dataset.digits ?? 3), lang()) : '—';
    }
    const bars = $$('[data-bar]', panel);
    const peak = result.ok ? Math.max(0, ...bars.map((b) => result.values[b.dataset.bar!] ?? 0)) : 0;
    for (const b of bars) {
      const v = result.ok ? (result.values[b.dataset.bar!] ?? 0) : 0;
      $<HTMLElement>('i', b)!.style.width = `${peak ? Math.round((v / peak) * 100) : 0}%`;
    }
    showState();
  }

  /** Модель из каталога: её паспортные значения в поля; удельный расход печи — для выбранного сплава. */
  function applyModel() {
    const e = chosen();
    if (facts) {
      const src = model ? $(`[data-calc-facts-src] [data-i="${model.value}"]`, panel) : null;
      facts.hidden = !e;
      $('[data-facts-text]', facts)!.textContent = text(src);
      $<HTMLAnchorElement>('[data-facts-link]', facts)!.href = e?.url ?? '#';
    }
    if (!e) return;
    for (const key of provided) {
      const el = input(key);
      if (el) el.value = el.defaultValue;
      const s = select(key);
      if (s) s.value = [...s.options].find((o) => o.defaultSelected)?.value ?? s.options[0]!.value;
    }
    const has = (s: HTMLSelectElement | null, v: string | undefined): s is HTMLSelectElement => Boolean(s && v && [...s.options].some((o) => o.value === v));
    for (const [key, v] of Object.entries(e.selects ?? {})) {
      const s = select(key);
      if (has(s, v)) s.value = v;
    }
    const alloy = select('alloy');
    if (has(alloy, e.alloy)) alloy.value = e.alloy!;
    for (const [key, v] of Object.entries(e.values)) {
      const el = input(key);
      if (el) el.value = String(v);
    }
    const specific = alloy && e.specific?.[alloy.value];
    if (specific) input('specific')!.value = String(specific);
    // расход по паспорту — значит, режим фактического удельного расхода
    const mode = select('mode');
    if (mode && (specific || e.values.specific !== undefined)) mode.value = 'measured';
  }

  form.addEventListener('input', (ev) => {
    if (ev.target === model) return;
    // сплав при выбранной модели: удельный расход — из её паспорта для этого сплава
    if ((ev.target as HTMLElement).matches('select[name="alloy"]')) {
      const v = chosen()?.specific?.[(ev.target as HTMLSelectElement).value];
      if (v) input('specific')!.value = String(v);
    }
    state = 'own';
    render();
  });
  model?.addEventListener('change', () => {
    applyModel();
    state = chosen() ? 'model' : 'own';
    render();
  });
  $('[data-calc-reset]', panel)?.addEventListener('click', () => {
    form.reset();
    applyModel();
    state = 'example';
    render();
  });

  /** Расчёт текстом: исходные данные и результат — подписи как на странице. */
  function summary(): string {
    const lines = [text($('.calc__tab.is-active') ?? null) || def.title, new Date().toLocaleDateString(lang())];
    const e = chosen();
    if (e && model) lines.push(`${text(model.labels?.[0] ?? null)}: ${e.name} — ${new URL(localized(e.url), location.origin).href}`);
    lines.push('', text($('.calc__form-head .calc__h2', panel)));
    for (const s of $$<HTMLSelectElement>('select[name]', form)) lines.push(`${text(s.closest('label')?.querySelector('.calc__label') ?? null)}: ${text(s.selectedOptions[0] ?? null)}`);
    for (const box of $$('[data-field]', form)) {
      if (box.hidden) continue;
      const unit = $$('.calc__unit > span, .calc__unit', box).find((u) => !u.hidden && !u.querySelector('span'));
      lines.push(`${text($('label', box))}: ${$<HTMLInputElement>('input', box)!.value} ${text(unit ?? null)}`.trim());
    }
    lines.push('', text($('.calc__result-head .calc__h2', panel)));
    lines.push(`${text($('.calc__main-label', panel))}: ${text($('.calc__main', panel))}`, text($('.calc__note', panel)));
    for (const m of $$('.calc__metric', panel)) lines.push(`${text($('dt', m))}: ${text($('dd', m))}`);
    return lines.join('\n');
  }

  $('[data-calc-save]', panel)?.addEventListener('click', () => {
    const blob = new Blob([`﻿${summary()}\n`], { type: 'text/plain;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `raschet-${def.hash}-${new Date().toISOString().slice(0, 10)}.txt` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('[data-calc-print]', panel)?.addEventListener('click', () => window.print());
  // форма заявки на странице: итог расчёта — в поле задачи, затем к форме
  $('[data-calc-contact]', panel)?.addEventListener('click', (ev) => {
    const lead = document.getElementById('leadgen');
    const task = lead?.querySelector<HTMLTextAreaElement>('textarea[name="task"]');
    if (!lead) return;
    ev.preventDefault();
    if (task) {
      task.value = summary();
      task.dispatchEvent(new Event('input', { bubbles: true }));
    }
    lead.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(history.state, '', `${location.pathname}${location.search}#leadgen`);
  });

  // пределы в подсказках ошибок — в записи чисел языка страницы (сервер выводит их по-русски)
  for (const box of $$('[data-field]', form)) {
    const field = $<HTMLInputElement>('input', box)!;
    const [lo, hi] = $$(':scope > .calc__error > span:not(.calc__error-int)', box);
    if (lo) lo.textContent = formatNumber(Number(field.min), 4, lang());
    if (hi) hi.textContent = formatNumber(Number(field.max), 4, lang());
  }

  applyModel();
  render();
}

function initSection(section: HTMLElement) {
  const data = JSON.parse($('.calc__data', section)?.textContent || '{}') as { equipment?: Partial<Record<CalcId, Equipment[]>> };
  const tabs = $$<HTMLButtonElement>('[role="tab"]', section);
  const panels = $$('.calc__panel', section);
  for (const p of panels) initPanel(p, data.equipment?.[p.dataset.calc as CalcId] ?? []);

  const select = (tab: HTMLButtonElement, focus = false) => {
    for (const t of tabs) {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(`#${t.getAttribute('aria-controls')}`, section)!.hidden = !on;
    }
    if (focus) tab.focus();
  };
  for (const t of tabs) {
    t.addEventListener('click', () => {
      select(t);
      history.replaceState(history.state, '', `${location.pathname}${location.search}#${t.dataset.tab}`);
    });
    // стрелки — соседняя вкладка, Home/End — первая и последняя
    t.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(t);
      const moves: Record<string, number> = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      const to = moves[e.key];
      if (to === undefined) return;
      e.preventDefault();
      const next = tabs[(to + tabs.length) % tabs.length]!;
      select(next, true);
      history.replaceState(history.state, '', `${location.pathname}${location.search}#${next.dataset.tab}`);
    });
  }
  // ссылка на калькулятор: /kalkulyatory/#drob
  const linked = tabs.find((t) => `#${t.dataset.tab}` === location.hash);
  if (linked) select(linked);
}

for (const section of $$('[data-calculators]')) initSection(section);
