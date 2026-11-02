import { AnalyticsNoscript } from './Analytics';

/**
 * Скрипты в конце <body>: клиентские модули страницы (ES-модули, выполняются
 * после разбора HTML), старые скрипты блоков «HTML как есть», счётчики.
 */
export function SiteScripts({ modules, legacy }: { modules: string[]; legacy: string[] }) {
  return (
    <>
      {modules.map((src) => (
        <script key={src} type="module" src={src} />
      ))}
      {legacy.map((src) => (
        <script key={src} src={src} defer />
      ))}
      <AnalyticsNoscript />
    </>
  );
}
