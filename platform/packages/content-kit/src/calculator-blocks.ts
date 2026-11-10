import type { Block, CalculatorsBlock } from '@mtpk/content-model';

/** Есть ли на странице блок калькуляторов (и в контейнерах). */
export function hasCalculatorBlocks(blocks: Block[]): boolean {
  return blocks.some((b) => b.type === 'calculators' || (b.type === 'container' && hasCalculatorBlocks(b.children)));
}

/** Блоки калькуляторов получают модели из каталога (calculator-equipment.ts) — их паспортные значения подставляет выбор. */
export function resolveCalculatorBlocks(blocks: Block[], equipment: CalculatorsBlock['equipment']): Block[] {
  const resolve = (b: Block): Block => {
    if (b.type === 'container') return { ...b, children: b.children.map(resolve) };
    if (b.type === 'calculators') return { ...b, equipment };
    return b;
  };
  return blocks.map(resolve);
}
