/**
 * Русские строки, которые вставляют в страницу скрипты сайта и сервис заявок (подсказки, ошибки, таблица сравнения,
 * окно поиска): сервер их не видит — их переводит на лету модуль client/i18n.ts по этому списку.
 * Пишет packages/content-kit/src/ui-strings.ts; запускать после правки текстов в скриптах.
 *   npx tsx scripts/kz/ui-strings.ts [--print]
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { htmlTexts } from '@mtpk/content-kit/i18n';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DIRS = ['apps/web/src/client', 'apps/web/src/legacy', 'apps/web/src/components', 'packages/ui/src/forms'];
/** Страница 404: одна на все языки, её целиком переводит браузер. */
const FILES = ['apps/web/src/pages/404.tsx'];
/** Только для тех, кто вошёл в админку; статьи Практикума (на этом сайте их нет); данные карты — свой файл на каждый язык. */
const SKIP = /(?:admin-bar|doc-bar|thermal-guide|inductor-guide|made-badges|projects-data|cases-data|LangSwitch|globals\.d)\b/;
/** Строки, склеенные скриптом из частей, ответы сервиса заявок; {n} — число (client/i18n.ts). */
const EXTRA = [
  'Страница не найдена — УралИндуктор',
  'Браузер не поддерживает защищённую отправку. Позвоните: +7 (775) 853-40-95',
  'Не удалось отправить. Позвоните: +7 (775) 853-40-95',
  'Не удалось получить подтверждение отправки. Данные сохранены в форме — попробуйте ещё раз. Позвоните: +7 (775) 853-40-95',
  'Вы пока ничего не выбрали. Отметьте «К сравнению» на карточках товара — здесь появится таблица характеристик.',
  'Выбранные позиции уйдут вместе с заявкой. Инженер уточнит задачу и предложит решение под ваше производство.',
  'Отправить менеджеру на просчёт',
  'В этой категории пока нет проектов',
  'Масса — любая',
  'Мощность — любая',
  'Производительность — любая',
  '{n} модель',
  '{n} модели',
  '{n} моделей',
  '{n} позиция',
  '{n} позиции',
  '{n} позиций',
  'Найдено: {n}',
  'Найдено: {n} · Страница {n} из {n}',
  'Показано {n}–{n} из {n}',
  'Показано {n}–{n} из {n} записей',
  'Страница {n} из {n}',
  'Фото {n}',
  'Видео {n}',
  'Заявка отправлена! Мы свяжемся с вами в рабочее время.',
  'Заявка принята',
  'Укажите корректный телефон',
  'Некорректный email',
  'Недопустимый источник запроса',
  'Слишком много заявок. Попробуйте через минуту.',
];
const CYRILLIC = /[А-Яа-яЁё]/;

const literals = new Set<string>();
const sourceFiles = [
  ...FILES,
  ...DIRS.flatMap((dir) => (fs.readdirSync(path.join(ROOT, dir), { recursive: true }) as string[]).map((name) => path.join(dir, name))),
];
for (const name of sourceFiles) {
  if (!/\.tsx?$/.test(name) || name.endsWith('.test.ts') || SKIP.test(name)) continue;
  const file = path.join(ROOT, name);
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const walk = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) {
      if (CYRILLIC.test(node.text)) literals.add(node.text);
    }
    ts.forEachChild(node, walk);
  };
  walk(source);
}

/** Литерал — обычный текст или кусок разметки: в словарь идут его тексты и подписи (alt, title, aria-label…). */
const strings = new Set<string>(EXTRA);
for (const literal of literals) {
  // кусок разметки из склейки ('…">Текст') — начало до первого закрытого тега отрезает сам разбор
  const clean = literal.replace(/^[^<]*?["']\s*>/, '');
  for (const text of htmlTexts(clean)) if (CYRILLIC.test(text)) strings.add(text);
}

const list = [...strings].sort((a, b) => a.localeCompare(b, 'ru'));
if (process.argv.includes('--print')) {
  console.log(list.join('\n'));
} else {
  const body = list.map((s) => `  ${JSON.stringify(s)},`).join('\n');
  fs.writeFileSync(
    path.join(ROOT, 'packages/content-kit/src/ui-strings.ts'),
    `/** Строки из скриптов сайта и сервиса заявок (создаёт scripts/kz/ui-strings.ts, вручную не править). */\nexport const UI_STRINGS: string[] = [\n${body}\n];\n`,
  );
  console.log(`строк: ${list.length}`);
}
