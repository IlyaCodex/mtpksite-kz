/**
 * Пачки строк для перевода: exports/kz-missing.json (scripts/kz/missing-translations.ts) и строки скриптов сайта без перевода.
 * Пишет <out>/<язык>-NNN.in.json — { "номер": "русская строка" } — и <out>/glossary-<язык>.json: термины, которые уже переведены
 * на живом сайте и часто встречаются в новых строках, чтобы перевод был единообразным. Результат переводчика —
 * <out>/<язык>-NNN.out.json с теми же номерами, в базу его кладёт scripts/kz/import-machine.ts.
 *   npx tsx scripts/kz/translate-batches.ts --out=папка [--size=18000]
 */
import fs from 'node:fs';
import path from 'node:path';
import { UI_STRINGS } from '@mtpk/content-kit/ui-strings';
import { createDb } from '@mtpk/db';

const here = import.meta.dirname;
process.loadEnvFile(path.resolve(here, '../../.env'));
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const OUT = arg('out');
if (!OUT) throw new Error('укажите --out=папка');
const SIZE = Number(arg('size') ?? 18_000);
const MISSING = path.resolve(here, '../../../exports/kz-missing.json');

interface Row {
  source: string;
  page: string;
  count: number;
}
const missing = JSON.parse(fs.readFileSync(MISSING, 'utf8')) as Record<'kz' | 'en', Row[]>;

/** Код модели («УИД-3210», «УИ-0.5Т-400») не переводится: русских слов в нём нет. */
const hasWords = (s: string) => /[А-Яа-яЁё]{2,}/.test(s.replace(/(?:^|[\s(])[А-ЯЁA-Z]{2,}[-‑]?[\dА-ЯЁA-Z.,/-]*(?=$|[\s),.;:])/g, ' '));

const { db, close } = createDb(process.env.DATABASE_URL!, { max: 2, appName: 'kz-translate-batches' });
fs.mkdirSync(OUT, { recursive: true });

for (const locale of ['kz', 'en'] as const) {
  const rows = await db.translation.findMany({ where: { locale }, select: { source: true, target: true } });
  const dict = new Map(rows.map((r) => [r.source, r.target]));
  const strings = [...new Set([...missing[locale].map((r) => r.source), ...UI_STRINGS.filter((s) => !dict.has(s))])].filter(hasWords);

  // пачки по порядку страниц: рядом — строки одной темы
  let batch: Record<string, string> = {};
  let chars = 0;
  let n = 0;
  let id = 0;
  const flush = () => {
    if (!chars) return;
    n++;
    fs.writeFileSync(path.join(OUT, `${locale}-${String(n).padStart(3, '0')}.in.json`), JSON.stringify(batch, null, 0));
    batch = {};
    chars = 0;
  };
  for (const s of strings) {
    batch[String(++id)] = s;
    chars += s.length;
    if (chars >= SIZE) flush();
  }
  flush();

  // термины: словосочетания из словаря (отдельные слова там бывают вырваны из контекста), которые чаще всего встречаются внутри новых строк
  const text = strings.join('\n').toLowerCase();
  const terms = rows
    .filter((r) => r.source.includes(' ') && r.source.length <= 42 && !/\d/.test(r.source) && /^[А-ЯЁа-яё -]+$/.test(r.source))
    .map((r) => ({ ...r, hits: text.split(r.source.toLowerCase()).length - 1 }))
    .filter((r) => r.hits >= 5)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 200);
  fs.writeFileSync(path.join(OUT, `glossary-${locale}.json`), JSON.stringify(Object.fromEntries(terms.map((r) => [r.source, r.target])), null, 0));
  console.log(`${locale}: строк ${strings.length}, знаков ${strings.join('').length}, пачек ${n}, терминов ${terms.length}`);
}
await close();
