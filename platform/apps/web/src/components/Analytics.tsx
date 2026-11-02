/**
 * Пиксель счётчика для браузеров без JavaScript. Сами счётчики (Метрика, Roistat)
 * запускает клиентский модуль consent.ts — после согласия на cookie.
 */
export function AnalyticsNoscript() {
  return (
    <noscript>
      <div>
        <img src="https://mc.yandex.ru/watch/111375860" className="ui-pixel" alt="" />
      </div>
    </noscript>
  );
}
