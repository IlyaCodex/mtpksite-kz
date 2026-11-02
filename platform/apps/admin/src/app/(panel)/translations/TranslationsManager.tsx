'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { toast } from '@/components/toast';
import { Badge, Button, Table } from '@/components/ui';
import { api } from '@/lib/client-api';

type Row = { source: string; target: string; origin: string };
const LIMIT = 100;
const LOCALES = [
  { id: 'kz', label: 'Казахский' },
  { id: 'en', label: 'Английский' },
] as const;
const ORIGIN: Record<string, { label: string; tone: 'green' | 'blue' | 'amber' }> = {
  live: { label: 'с прежнего сайта', tone: 'blue' },
  machine: { label: 'машинный', tone: 'amber' },
  manual: { label: 'вручную', tone: 'green' },
};

/** Строка словаря: сохраняется при выходе из поля, если текст изменился; пустой текст убирает перевод. */
function TranslationRow({ row, locale }: { row: Row; locale: string }) {
  const [target, setTarget] = useState(row.target);
  const [saved, setSaved] = useState(row.target);
  const [origin, setOrigin] = useState(row.origin);
  const originInfo = ORIGIN[origin];

  async function save() {
    if (target === saved) return;
    try {
      await api('content/translations', { method: 'PUT', json: { locale, source: row.source, target } });
      setSaved(target);
      setOrigin(target.trim() ? 'manual' : '');
      toast.ok('Перевод сохранён');
    } catch (err) {
      toast.error(err);
    }
  }

  return (
    <tr className="align-top hover:bg-slate-50">
      <td className="w-1/2 px-4 py-2 text-sm whitespace-pre-wrap text-slate-700">{row.source}</td>
      <td className="w-1/2 px-4 py-2">
        <textarea
          className="field min-h-10 w-full text-sm"
          rows={Math.min(6, Math.ceil(Math.max(row.source.length, target.length) / 60) || 1)}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onBlur={() => void save()}
        />
      </td>
      <td className="px-4 py-2 whitespace-nowrap">{originInfo ? <Badge tone={originInfo.tone}>{originInfo.label}</Badge> : <Badge tone="amber">нет перевода</Badge>}</td>
    </tr>
  );
}

export function TranslationsManager() {
  const [locale, setLocale] = useState<string>('kz');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState('');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ total: number; items: Row[] } | null>(null);

  const load = useCallback(async () => {
    const q = new URLSearchParams({ locale, offset: String(offset), limit: String(LIMIT), ...(search.trim() ? { search: search.trim() } : {}) });
    try {
      setData(await api(page.trim() ? `content/translations/missing?${new URLSearchParams({ locale, scope: page.trim() })}` : `content/translations?${q}`));
    } catch (err) {
      toast.error(err);
    }
  }, [locale, offset, search, page]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function refreshSite() {
    if (!window.confirm('Перегенерировать все страницы на трёх языках? На сервере это занимает несколько минут.')) return;
    try {
      await api('content/cache/purge', { json: {} });
      toast.ok('Страницы обновляются');
    } catch (err) {
      toast.error(err);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="field w-40"
          value={locale}
          onChange={(e) => {
            setLocale(e.target.value);
            setOffset(0);
          }}
        >
          {LOCALES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
        <input
          className="field max-w-72"
          placeholder="Поиск по тексту"
          value={search}
          disabled={Boolean(page.trim())}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
        />
        <input
          className="field max-w-80 font-mono text-xs"
          placeholder="Что не переведено: /адрес/, ui или settings"
          title="Адрес страницы без языка, ui — надписи скриптов, settings — шапка, меню, подвал"
          value={page}
          onChange={(e) => {
            setPage(e.target.value);
            setOffset(0);
          }}
        />
        {data && <span className="text-sm text-slate-500">найдено: {data.total}</span>}
        <span className="flex-1" />
        <Button size="sm" onClick={() => void refreshSite()}>
          Обновить страницы сайта
        </Button>
      </div>

      {data && (
        <Table head={['По-русски', 'Перевод', 'Откуда']}>
          {data.items.map((row) => (
            <TranslationRow key={`${locale}:${row.source}`} row={row} locale={locale} />
          ))}
        </Table>
      )}
      {data && !page.trim() && data.total > LIMIT && (
        <div className="flex gap-2">
          <Button size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>
            <Icon name="chevronLeft" className="h-4 w-4" />
            Назад
          </Button>
          <Button size="sm" disabled={offset + LIMIT >= data.total} onClick={() => setOffset(offset + LIMIT)}>
            Вперёд
            <Icon name="chevronRight" className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
