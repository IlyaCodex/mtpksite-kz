/**
 * Какие клиентские скрипты нужны странице с блоками «HTML как есть»
 * (аудит 01.10.2026, P2-3). Маркеры намеренно шире, чем нужно скрипту:
 * лишний файл безвреден, недостающий ломает функциональность.
 * Проверяются по HTML этих блоков.
 */
export const PAGE_FEATURES: [string, RegExp][] = [
  // галерея и бейджи карточки товара
  ['phero-gallery', /class="phero__(media|main)/],
  ['stock-product', /class="phero"/],
  // «Запросить цену» — дозапись позиции в форму (карточка и плитки каталога)
  ['quote-form', /class="(phero__title|pcard)|js-quote-btn/],
  // плитки каталога: наличие, сравнение, фильтр
  ['stock-badges', /class="pcard/],
  ['compare', /class="pcard|class="phero__actions|data-compare/],
  ['catalog-filter', /data-filter-form/],
  // оглавление характеристик
  ['spec-tabs', /class="spec[\s"]/],
  // каталоги запчастей
  ['zapchasti-catalog', /class="product-card|id="products"/],
  ['zapchasti-tranzistornye', /ui-transistor-site|data-catalog/],
  // проекты: реестр и подробный кейс
  ['projects', /id="pr-data"|class="pr-root/],
  ['project-case', /class="ui-case/],
];

export function detectPageFeatures(rawBody: string): string[] {
  return PAGE_FEATURES.filter(([, re]) => re.test(rawBody)).map(([name]) => name);
}

/** CSS внутри <style>…</style> (inline-блоки meta.inline_styles — по одному элементу). */
export function styleBlockCss(block: string): string {
  return block.replace(/^\s*<style[^>]*>/, '').replace(/<\/style>\s*$/, '');
}
