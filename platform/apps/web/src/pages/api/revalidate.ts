import type { NextApiRequest, NextApiResponse } from 'next';
import { LOCALES } from '@mtpk/content-kit/i18n';
import { listPages, resetDictionaries } from '@/lib/content';

/** Страница живёт на каждом языке: контент-сервис знает её адрес без языка. */
const onAllLocales = (paths: string[]) => paths.flatMap((p) => LOCALES.map((l) => `/${l}${p}`));

/** Перегенерировать страницу; если её больше нет — не ошибка (она отдаст 404). */
async function regenerate(res: NextApiResponse, path: string): Promise<boolean> {
  try {
    await res.revalidate(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Сигнал от контент-сервиса: страницы изменились — перегенерировать их
 * готовый HTML. POST { paths: ['/products/x/'] } или { all: true },
 * заголовок x-revalidate-secret. «Всё» (смена меню, наличия, переводов: dictionaries) —
 * в фоне, по нескольку страниц параллельно: ответ приходит сразу.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const secret = process.env.REVALIDATE_SECRET;
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (!secret || req.headers['x-revalidate-secret'] !== secret) return res.status(401).json({ ok: false, error: 'unauthorized' });
  const body = (req.body ?? {}) as { paths?: unknown; all?: unknown; dictionaries?: unknown };
  if (body.dictionaries === true) resetDictionaries();

  if (body.all === true) {
    const paths = onAllLocales((await listPages()).filter((p) => p.kind === 'page').map((p) => p.path));
    void (async () => {
      // страниц втрое больше, а сервер меньше основного: параллельно — понемногу
      for (let i = 0; i < paths.length; i += 3) {
        await Promise.all(paths.slice(i, i + 3).map((p) => regenerate(res, p)));
      }
      await regenerate(res, '/404');
    })();
    return res.status(202).json({ ok: true, revalidating: paths.length });
  }

  const paths = (Array.isArray(body.paths) ? body.paths : []).filter((p): p is string => typeof p === 'string' && p.startsWith('/')).slice(0, 5000);
  let done = 0;
  for (const p of onAllLocales(paths)) if (await regenerate(res, p)) done++;
  return res.json({ ok: true, revalidated: done });
}
