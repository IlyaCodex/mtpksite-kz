/**
 * Переводы из пачек scripts/kz/translate-batches.ts — в словарь сайта (origin=machine). Правки вручную не трогает.
 * Проверяет каждую строку: перевод есть, числа те же; расхождения — в консоль, такие строки не загружаются и
 * остаются в следующей пачке.
 *   npx tsx scripts/kz/import-machine.ts --in=папка [--dry]
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeText } from '@mtpk/content-kit/i18n';
import { createDb } from '@mtpk/db';

const here = import.meta.dirname;
process.loadEnvFile(path.resolve(here, '../../.env'));
const dir = process.argv.find((a) => a.startsWith('--in='))?.slice(5);
if (!dir) throw new Error('укажите --in=папка');
const dry = process.argv.includes('--dry');

const numbers = (s: string) => (s.match(/\d+/g) ?? []).sort().join(' ');
const CYRILLIC_WORD = /[А-Яа-яЁё]{3,}/;
/** Код модели («УИ-1Т-800») в английском тексте остаётся кириллицей — не считаем его непереведённым. */
const withoutCodes = (s: string) => s.replace(/[А-ЯЁA-Z]{2,}[-‑]?[\dА-ЯЁA-Zа-яё.,/-]*/g, ' ');

const { db, close } = createDb(process.env.DATABASE_URL!, { max: 4, appName: 'kz-import-machine' });
const stats = { ok: 0, absent: 0, numbers: 0, untranslated: 0 };
/** Подписи переключателя языка не переводятся. */
const NEVER = new Set(['РУС', 'ҚАЗ', 'ENG', 'Қазақша', 'Русский']);
const problems: string[] = [];

for (const file of fs.readdirSync(dir).filter((f) => /^(?:kz|en)-\d+\.out\.json$/.test(f)).sort()) {
  const locale = file.slice(0, 2);
  const sources = JSON.parse(fs.readFileSync(path.join(dir, file.replace('.out.', '.in.')), 'utf8')) as Record<string, string>;
  let targets: Record<string, string>;
  try {
    targets = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as Record<string, string>;
  } catch (err) {
    // файл ещё дописывается или испорчен: пачка останется на следующий запуск
    problems.push(`${file}: не разбирается — ${(err as Error).message.slice(0, 120)}`);
    continue;
  }
  const rows: { locale: string; hash: string; source: string; target: string; origin: string }[] = [];
  for (const [id, raw] of Object.entries(sources)) {
    const source = normalizeText(raw);
    const target = normalizeText(targets[id] ?? '');
    if (NEVER.has(source)) continue;
    if (!target) {
      stats.absent++;
      continue;
    }
    const tags = (s: string) => (s.match(/<\/?[a-z]+>/g) ?? []).sort().join(' ');
    if (source.includes('<') && tags(source) !== tags(target)) {
      stats.numbers++;
      problems.push(`${file} #${id} теги: ${source} → ${target}`);
      continue;
    }
    if (numbers(source) !== numbers(target)) {
      stats.numbers++;
      problems.push(`${file} #${id} числа: ${source} → ${target}`);
      continue;
    }
    if (locale === 'en' && CYRILLIC_WORD.test(withoutCodes(target))) {
      stats.untranslated++;
      problems.push(`${file} #${id} кириллица: ${source} → ${target}`);
      continue;
    }
    rows.push({ locale, hash: crypto.createHash('sha1').update(source).digest('hex'), source, target, origin: 'machine' });
  }
  stats.ok += rows.length;
  if (dry || !rows.length) continue;
  // ручные правки важнее: строки с origin=manual не заменяем
  const manual = new Set((await db.translation.findMany({ where: { locale, origin: 'manual', hash: { in: rows.map((r) => r.hash) } }, select: { hash: true } })).map((r) => r.hash));
  for (let i = 0; i < rows.length; i += 200) {
    const part = rows.slice(i, i + 200).filter((r) => !manual.has(r.hash));
    await db.$transaction(part.map((r) => db.translation.upsert({ where: { locale_hash: { locale: r.locale, hash: r.hash } }, create: r, update: { source: r.source, target: r.target, origin: r.origin } })));
  }
}
await close();
console.log(`загружено ${stats.ok}; нет перевода ${stats.absent}; числа разошлись ${stats.numbers}; осталась кириллица ${stats.untranslated}`);
if (problems.length) fs.writeFileSync(path.join(dir, 'problems.txt'), problems.join('\n'));
