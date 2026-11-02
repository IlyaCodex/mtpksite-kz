/** Стили библиотеки карты: сборщик отдаёт файл текстом (scripts/build-client.ts, loader), модуль вставляет его сам. */
declare module 'leaflet/dist/leaflet.css' {
  const css: string;
  export default css;
}
