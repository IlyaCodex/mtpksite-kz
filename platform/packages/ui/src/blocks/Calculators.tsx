import {
  calculate,
  CALCULATORS,
  exampleValues,
  formatNumber,
  withCurrency,
  type CalcDef,
  type CalcField,
  type CalcId,
  type CalcOutput,
  type CalcValues,
} from '@mtpk/content-kit/calculators';
import type { CalculatorsBlock } from '@mtpk/content-model';
import type { RenderContext } from '../context.ts';
import { extra, Inline } from '../primitives/Html.tsx';

type Equipment = NonNullable<CalculatorsBlock['equipment']>[CalcId];

/** Модели по группам выбора (порядок — как пришли из каталога). */
function byGroup(items: Equipment): [string, { item: Equipment[number]; index: number }[]][] {
  const groups = new Map<string, { item: Equipment[number]; index: number }[]>();
  items.forEach((item, index) => groups.set(item.group, [...(groups.get(item.group) ?? []), { item, index }]));
  return [...groups];
}

function Unit({ field, currency, values }: { field: CalcField; currency: string; values: CalcValues }) {
  if (!field.units) return <span className="calc__unit">{withCurrency(field.unit, currency)}</span>;
  // единица зависит от выбора (база программы дроби): все варианты в разметке, скрипт показывает нужный
  const { select, by } = field.units;
  return (
    <span className="calc__unit" data-unit-select={select}>
      {Object.entries(by).map(([when, unit]) => (
        <span key={when} data-unit-when={when} hidden={values[select] !== when || undefined}>
          {unit}
        </span>
      ))}
    </span>
  );
}

function Field({ id, field, currency, values }: { id: CalcId; field: CalcField; currency: string; values: CalcValues }) {
  const inputId = `calc-${id}-${field.key}`;
  const off = field.when && values[field.when.select] !== field.when.is;
  return (
    <div className="calc__field" data-field={field.key} data-when={field.when ? `${field.when.select}:${field.when.is}` : undefined} hidden={off || undefined}>
      <label className="calc__label" htmlFor={inputId}>
        {field.label}
      </label>
      <span className="calc__input">
        <input
          id={inputId}
          name={field.key}
          type="number"
          inputMode="decimal"
          step="any"
          min={field.min}
          max={field.max}
          defaultValue={values[field.key] as number}
          title={field.hint}
          required
        />
        <Unit field={field} currency={currency} values={values} />
      </span>
      <small className="calc__error" hidden>
        {/* пределы — до 4 знаков после запятой: у массы шихты минимум 0,0001 т, с тремя знаками он выглядел бы нулём */}
        Допустимо: <span>{formatNumber(field.min, 4)}</span> – <span>{formatNumber(field.max, 4)}</span>
        {field.integer && <span className="calc__error-int"> · целое число</span>}
      </small>
    </div>
  );
}

const Value = ({ out, results, currency }: { out: CalcOutput; results: Record<string, number> | null; currency: string }) => (
  <>
    <output data-out={out.key} data-digits={out.digits ?? 3}>
      {results ? formatNumber(results[out.key] ?? 0, out.digits ?? 3) : '—'}
    </output>
    {out.unit && <span className="calc__out-unit"> {withCurrency(out.unit, currency)}</span>}
  </>
);

function Panel({ def, block, ctx, active }: { def: CalcDef; block: CalculatorsBlock; ctx: RenderContext; active: boolean }) {
  const { id } = def;
  const currency = block.currency;
  const values = exampleValues(def, block.examples);
  const result = calculate(id, values);
  const results = result.ok ? result.values : null;
  const equipment = block.equipment?.[id] ?? [];
  const peak = Math.max(...def.chart.bars.map((b) => results?.[b.key] ?? 0), 0);
  return (
    <div className="calc__panel" id={`calc-${def.hash}`} role="tabpanel" aria-labelledby={`calc-tab-${def.hash}`} data-calc={id} hidden={!active || undefined}>
      <form className="calc__form" noValidate>
        <div className="calc__form-head">
          <h2 className="calc__h2">Исходные данные</h2>
          <button type="button" className="calc__link" data-calc-reset="">
            Вернуть пример
          </button>
        </div>
        <p className="calc__notice">
          <span data-notice="example">Пример данных — замените своими.</span>
          <span data-notice="model" hidden>
            Значения модели из каталога — уточните под ваш процесс.
          </span>
        </p>
        <div className="calc__selects">
          {equipment.length > 0 && (
            <div className="calc__select calc__select--wide">
              <label className="calc__label" htmlFor={`calc-${id}-model`}>
                {def.equipment.label}
              </label>
              <select id={`calc-${id}-model`} data-calc-equipment="">
                <option value="">{def.equipment.manual}</option>
                {byGroup(equipment).map(([group, items]) => (
                  <optgroup key={group} label={group}>
                    {items.map(({ item, index }) => (
                      <option key={index} value={index}>
                        {item.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <small className="calc__facts" data-calc-facts="" hidden>
                <span data-facts-text=""></span>{' '}
                <a href="#" data-facts-link="">
                  Карточка модели <span aria-hidden="true">→</span>
                </a>
              </small>
            </div>
          )}
          {def.selects.map((s) => (
            <label key={s.key} className="calc__select">
              <span className="calc__label">{s.label}</span>
              <select name={s.key} defaultValue={values[s.key] as string}>
                {s.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {def.groups.map((g) => (
          <fieldset key={g.title} className="calc__group">
            <legend className="calc__legend">{g.title}</legend>
            <div className="calc__fields">
              {g.fields.map((f) => (
                <Field key={f.key} id={id} field={f} currency={currency} values={values} />
              ))}
            </div>
          </fieldset>
        ))}
        {/* паспортные строки моделей — здесь, чтобы их переводил словарь сайта; скрипт показывает строку выбранной */}
        {equipment.length > 0 && (
          <div hidden data-calc-facts-src="">
            {equipment.map((e, i) => (
              <span key={i} data-i={i} data-url={e.url}>
                {e.facts.join(' · ')}
              </span>
            ))}
          </div>
        )}
      </form>

      <aside className="calc__result" aria-label="Результат расчёта">
        <div className="calc__result-head">
          <h2 className="calc__h2">Ваш расчёт</h2>
          <span className="calc__state">
            <span data-state="example">Пример</span>
            <span data-state="own" hidden>
              Свои данные
            </span>
            <span data-state="model" hidden></span>
          </span>
        </div>
        <div className="calc__out" aria-live="polite">
          <p className="calc__main-label">{def.main.label}</p>
          <p className="calc__main">
            <Value out={def.main} results={results} currency={currency} />
          </p>
          <p className="calc__note">
            {def.note.map((n, i) => (
              <span key={n.key}>
                {i > 0 && (n.sep ?? ' · ')}
                {n.label} <Value out={n} results={results} currency={currency} />
              </span>
            ))}
          </p>
          <dl className="calc__metrics">
            {def.metrics.map((m) => (
              <div key={m.key} className="calc__metric">
                <dt>{m.label}</dt>
                <dd>
                  <Value out={m} results={results} currency={currency} />
                </dd>
              </div>
            ))}
          </dl>
          <div className="calc__chart">
            <h3 className="calc__h3">{def.chart.title}</h3>
            {def.chart.bars.map((b) => (
              <div key={b.key} className="calc__bar" data-bar={b.key}>
                <span className="calc__bar-label">{b.label}</span>
                <span className="calc__bar-value">
                  <Value out={b} results={results} currency={currency} />
                </span>
                <span className="calc__bar-track">
                  <i style={{ width: `${peak ? Math.round(((results?.[b.key] ?? 0) / peak) * 100) : 0}%` }}></i>
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="calc__invalid" data-calc-invalid="" hidden>
          Проверьте поля, отмеченные красным: расчёт появится, когда все значения будут в допустимых пределах.
        </p>
        <div className="calc__actions">
          <button type="button" className="btn btn--primary" data-calc-save="">
            Сохранить расчёт
          </button>
          <button type="button" className="btn btn--secondary" data-calc-print="">
            Печать / PDF
          </button>
        </div>
        <a className="calc__contact" href={ctx.hasLeadgenBlock ? '#leadgen' : '/kontakty/'} data-calc-contact="">
          Обсудить расчёт с инженером <span aria-hidden="true">→</span>
        </a>
        <a className="calc__catalog" href={def.catalog.href}>
          {def.catalog.label} в каталоге <span aria-hidden="true">→</span>
        </a>
      </aside>
    </div>
  );
}

/**
 * Калькуляторы расчёта: вкладки (плавка, расход дроби, смеси ХТС), в каждой — исходные данные с выбором модели из
 * каталога и «Ваш расчёт». Сервер выводит пример с готовым результатом; пересчёт, выбор модели, вкладки по адресу
 * #plavka / #drob / #hts, сохранение и печать — client/calculators.ts. Подписи и формулы — content-kit/calculators.ts.
 */
export function Calculators({ block, ctx }: { block: CalculatorsBlock; ctx: RenderContext }) {
  const tabs = block.tabs.length ? block.tabs : (['melt', 'shot', 'hts'] as CalcId[]);
  const props = extra(block.attrs, 'section');
  return (
    <section id={block.attrs?.id ?? 'kalkulyatory'} data-calculators="" data-currency={block.currency} {...props} className={['calc', props.className].filter(Boolean).join(' ')}>
      <div className="calc__inner">
        <nav className="breadcrumb" aria-label="Хлебные крошки">
          <a href="/">Главная</a> <span className="breadcrumb__sep">/</span> <Inline as="span" className="breadcrumb__current" html={block.head.title.replace(/<[^>]+>/g, '')} />
        </nav>
        <div className="calc__head">
          {block.head.eyebrow && <Inline as="span" className="calc__eyebrow" html={block.head.eyebrow} />}
          <Inline as="h1" className="calc__title" html={block.head.title} />
          {block.head.lead && <Inline as="p" className="calc__lead" html={block.head.lead} />}
        </div>
        <div className="calc__tabs" role="tablist" aria-label="Калькуляторы">
          {tabs.map((id, i) => {
            const def = CALCULATORS[id];
            return (
              <button
                key={id}
                type="button"
                role="tab"
                className={`calc__tab${i === 0 ? ' is-active' : ''}`}
                id={`calc-tab-${def.hash}`}
                aria-controls={`calc-${def.hash}`}
                aria-selected={i === 0}
                tabIndex={i === 0 ? 0 : -1}
                data-tab={def.hash}
              >
                {def.tab}
              </button>
            );
          })}
        </div>
        {tabs.map((id, i) => (
          <Panel key={id} def={CALCULATORS[id]} block={block} ctx={ctx} active={i === 0} />
        ))}
      </div>
      <script
        type="application/json"
        className="calc__data"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({ equipment: block.equipment ?? {}, examples: block.examples }).replace(/</g, '\\u003c') }}
      />
    </section>
  );
}
