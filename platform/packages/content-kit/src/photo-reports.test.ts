import assert from 'node:assert/strict';
import { test } from 'node:test';
import { photoReportMonth, photoReportPlace, photoReportRegions, photoReportsRegionFirst, type Block, type PhotoReport } from '@mtpk/content-model';
import { hasPhotoReportBlocks, resolvePhotoReportBlocks } from './photo-reports.ts';

const report = (over: Partial<PhotoReport>): PhotoReport => ({
  id: 'r',
  hidden: false,
  kind: 'shipment',
  date: '2025-05-20',
  title: 'Отгрузка',
  region: '',
  city: '',
  text: '',
  photos: [{ src: '/img/otchety/2025/r/01.jpg', alt: '' }],
  videos: [],
  ...over,
});
const block = { type: 'photoReports', head: { title: 'Фотоотчёты' }, pageSize: 8, region: 'Москва и Московская область' } as Block;

test('блок получает отчёты: без скрытых и без фото, новые сверху', () => {
  const items = [
    report({ id: 'old', date: '2024-01-16' }),
    report({ id: 'new', date: '2025-12-27' }),
    report({ id: 'hidden', date: '2025-12-30', hidden: true }),
    report({ id: 'empty', date: '2025-12-31', photos: [] }),
  ];
  const [out] = resolvePhotoReportBlocks([block], items) as { items?: PhotoReport[] }[];
  assert.deepEqual(out.items?.map((r) => r.id), ['new', 'old']);
});

test('блок в контейнере тоже находится и заполняется', () => {
  const container = { type: 'container', tag: 'div', children: [block] } as unknown as Block;
  assert.equal(hasPhotoReportBlocks([container]), true);
  assert.equal(hasPhotoReportBlocks([{ type: 'text', text: 'x' } as Block]), false);
  const [out] = resolvePhotoReportBlocks([container], [report({ id: 'a' })]) as unknown as { children: { items?: PhotoReport[] }[] }[];
  assert.equal(out.children[0].items?.length, 1);
});

test('выбор региона: Москва с областью — одной строкой и первой, остальные по алфавиту; отчёты региона — первыми', () => {
  const items = [
    report({ id: 'kurgan', region: 'Курганская область' }),
    report({ id: 'msk', region: 'Москва' }),
    report({ id: 'none', region: '' }),
    report({ id: 'mo', region: 'Московская область' }),
    report({ id: 'altai', region: 'Алтайский край' }),
  ];
  assert.deepEqual(
    photoReportRegions(items).map((g) => [g.label, g.count]),
    [
      ['Москва и Московская область', 2],
      ['Алтайский край', 1],
      ['Курганская область', 1],
    ],
  );
  assert.deepEqual(photoReportsRegionFirst(items, 'Москва и Московская область').map((r) => r.id), ['msk', 'mo', 'kurgan', 'none', 'altai']);
  assert.deepEqual(photoReportsRegionFirst(items, 'Алтайский край').map((r) => r.id), ['altai', 'kurgan', 'msk', 'none', 'mo']);
  assert.deepEqual(photoReportsRegionFirst(items, '').map((r) => r.id), ['kurgan', 'msk', 'none', 'mo', 'altai']);
});

test('плашка и место: месяц с годом, регион и город', () => {
  assert.equal(photoReportMonth('2025-05-20'), 'Май 2025');
  assert.equal(photoReportPlace({ region: 'Курганская область', city: 'г. Курган' }), 'Курганская область, г. Курган');
  assert.equal(photoReportPlace({ region: '', city: '' }), '');
});
