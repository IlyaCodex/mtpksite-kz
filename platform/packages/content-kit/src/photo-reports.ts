import { sitePhotoReports, type Block, type PhotoReport } from '@mtpk/content-model';

/** Есть ли на странице блок фотоотчётов (и в контейнерах). */
export function hasPhotoReportBlocks(blocks: Block[]): boolean {
  return blocks.some((b) => b.type === 'photoReports' || (b.type === 'container' && hasPhotoReportBlocks(b.children)));
}

/** Блоки фотоотчётов получают отчёты из раздела «Фотоотчёты»: без скрытых, новые сверху. */
export function resolvePhotoReportBlocks(blocks: Block[], items: PhotoReport[]): Block[] {
  const shown = sitePhotoReports(items);
  const resolve = (b: Block): Block => {
    if (b.type === 'container') return { ...b, children: b.children.map(resolve) };
    if (b.type === 'photoReports') return { ...b, items: shown };
    return b;
  };
  return blocks.map(resolve);
}
