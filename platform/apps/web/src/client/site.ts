/**
 * Общий клиентский модуль — подключается на всех страницах: шапка и
 * мобильное меню, поиск (грузится по клику), формы заявок, «Запросить цену»,
 * скролл к форме, маска телефона, сравнение, согласие на cookie и аналитика,
 * кнопка «Наверх», переключатель светлой и тёмной темы.
 * Модули отдельных блоков (галерея, просмотр фото, оглавление, фильтр
 * каталога) страница подключает только там, где эти блоки есть.
 */
import { initCompare } from './compare';
import { initConsent } from './consent';
import { ready } from './dom';
import { initForms } from './forms';
import { initHeader } from './header';
import { initI18n } from './i18n';
import { initPage } from './page';
import { initTheme } from './theme';
import { initToTop } from './to-top';

// раньше скриптов страницы: то, что они вставят, сразу приводится к языку страницы
initI18n();

ready(() => {
  initHeader();
  initPage();
  initForms();
  initCompare();
  initConsent();
  initToTop();
  initTheme();
  // вошли в админку — панель администратора (модуль грузится только им)
  if (/(?:^|;\s*)mtpk_bar=1/.test(document.cookie)) void import('./admin-bar').then((m) => m.mountAdminBar());
  // справочник режимов термообработки (Практикум): поиск, фильтр, пример расчёта — модуль только этой статьи
  const guide = document.querySelector<HTMLElement>('.ui-thermal-guide');
  if (guide) void import('./thermal-guide').then((m) => m.initThermalGuide(guide));
  // статьи об индукторах (Практикум): проверка размерной цепи зазора, цели Метрики по ссылкам — модуль только им
  const lesson = document.querySelector<HTMLElement>('.ui-education');
  if (lesson?.querySelector('[data-gap-calculator], [data-inductor-event]')) void import('./inductor-guide').then((m) => m.initInductorGuide(lesson));
});
