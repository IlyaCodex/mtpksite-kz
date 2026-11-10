import fs from 'node:fs';
import path from 'node:path';

/** Клиентские модули (см. scripts/build-client.ts). */
export type ClientModule =
  | 'site'
  | 'gallery'
  | 'lightbox'
  | 'spec-nav'
  | 'catalog-filter'
  | 'carousel'
  | 'stock'
  | 'spare'
  | 'doc-bar'
  | 'holiday-fx'
  | 'core.css'
  | 'core-end.css'
  | 'free-map'
  | 'photo-reports'
  | 'calculators';

const MANIFEST = path.join(process.cwd(), 'public/assets/manifest.json');
let cached: Record<string, string> | null = null;

/** Манифест сборки; в разработке перечитывается (сборщик в режиме watch пересобирает файлы). */
function manifest(): Record<string, string> {
  if (!cached || process.env.NODE_ENV !== 'production') {
    try {
      cached = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as Record<string, string>;
    } catch {
      cached = {};
    }
  }
  return cached;
}

/** Адреса собранных модулей с хешем в имени. */
export function clientModuleUrl(name: ClientModule): string | null {
  return manifest()[name] ?? null;
}

/**
 * Шаблонные стили страницы (/css/tpl/имя.css): собранный файл с цветами
 * тёмной темы (assets/tpl, адрес с хешем); нет сборки — исходный файл с версией.
 */
export function templateCssUrl(href: string): string {
  const name = /^\/css\/tpl\/([\w.-]+\.css)$/.exec(href)?.[1];
  return (name && manifest()[`tpl/${name}`]) || `${href}?v=${manifest()['tpl-css-version'] ?? 'dev'}`;
}
