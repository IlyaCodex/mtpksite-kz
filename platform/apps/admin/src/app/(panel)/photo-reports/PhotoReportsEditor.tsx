'use client';

import { useMemo, useRef, useState } from 'react';
import {
  PHOTO_REPORT_KINDS,
  photoReportMonth,
  photoReportPlace,
  photoReportSettings,
  type PhotoReport,
  type PhotoReportKind,
  type PhotoReportSettings,
  type PhotoReportVideo,
} from '@mtpk/content-model';
import { GalleryField } from '@/components/gallery-field';
import { Icon } from '@/components/icons';
import { fileSrc, uploadFile } from '@/components/media';
import { toast } from '@/components/toast';
import { Badge, Button, Card, cx, Field } from '@/components/ui';
import { api } from '@/lib/client-api';

/** Столько пропускают шлюз и медиасервис за одну загрузку. */
const VIDEO_MAX = 50 * 1024 * 1024;

/** Папка отчёта в медиатеке: img/otchety/<год>/<отчёт>/. */
const folderOf = (r: PhotoReport) => `img/otchety/${r.date.slice(0, 4)}/${r.id}/`;

function newReport(): PhotoReport {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: `${today.replace(/-/g, '').slice(2)}-${Math.random().toString(36).slice(2, 6)}`,
    hidden: false,
    kind: 'shipment',
    date: today,
    title: '',
    region: '',
    city: '',
    text: '',
    photos: [],
    videos: [],
  };
}

/**
 * Кадр для обложки видео — из уже загруженного файла (адрес админки: политика безопасности
 * пускает видео только со своего адреса, не из файла на компьютере). Не вышло — без обложки.
 */
async function capturePoster(url: string): Promise<Blob | null> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await new Promise<void>((ok, fail) => {
      video.addEventListener('loadeddata', () => ok(), { once: true });
      video.addEventListener('error', () => fail(new Error('video')), { once: true });
    });
    const seeked = new Promise<void>((ok) => video.addEventListener('seeked', () => ok(), { once: true }));
    video.currentTime = Math.min(1.5, (video.duration || 3) * 0.3);
    await seeked;
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
  } catch {
    return null;
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}

/** Что мешает показать отчёт на сайте. */
function problemOf(r: PhotoReport): string | null {
  if (r.hidden) return 'скрыт';
  if (!r.photos.length) return 'нет фото';
  if (!r.title.trim()) return 'нет заголовка';
  return null;
}

export function PhotoReportsEditor({ initial, siteUrl }: { initial: PhotoReportSettings; siteUrl: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [saving, setSaving] = useState(false);
  const [year, setYear] = useState('');
  const [query, setQuery] = useState('');
  const sorted = useMemo(() => [...value.items].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)), [value.items]);
  const [selectedId, setSelectedId] = useState(() => sorted[0]?.id ?? '');
  const dirty = JSON.stringify(value) !== saved;
  const current = value.items.find((r) => r.id === selectedId) ?? null;
  const years = useMemo(() => [...new Set(value.items.map((r) => r.date.slice(0, 4)))].sort().reverse(), [value.items]);
  const regions = useMemo(() => [...new Set(value.items.map((r) => r.region.trim()).filter(Boolean))].sort(), [value.items]);
  const onSite = value.items.filter((r) => !problemOf(r)).length;
  const q = query.trim().toLowerCase();
  const shown = sorted.filter(
    (r) => (!year || r.date.startsWith(year)) && (!q || `${r.title} ${r.region} ${r.city} ${r.text}`.toLowerCase().includes(q)),
  );

  const update = (patch: Partial<PhotoReport>) => setValue((v) => ({ ...v, items: v.items.map((r) => (r.id === selectedId ? { ...r, ...patch } : r)) }));

  async function save() {
    const parsed = photoReportSettings.safeParse(value);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const at = issue?.path[0] === 'items' && typeof issue.path[1] === 'number' ? `«${value.items[issue.path[1]]?.title || 'без заголовка'}»: ` : '';
      toast.error(`${at}${issue?.message ?? 'проверьте поля'}`);
      return;
    }
    setSaving(true);
    try {
      await api('content/photo-reports', { method: 'PUT', json: parsed.data });
      setSaved(JSON.stringify(value));
      toast.ok('Фотоотчёты сохранены — страница обновится в течение минуты');
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  }

  const add = () => {
    const r = newReport();
    setValue((v) => ({ ...v, items: [...v.items, r] }));
    setSelectedId(r.id);
    setYear('');
    setQuery('');
  };
  const remove = () => {
    if (!current || !window.confirm(`Удалить отчёт «${current.title || 'без заголовка'}»? Файлы останутся в медиатеке.`)) return;
    const rest = sorted.filter((r) => r.id !== current.id);
    setValue((v) => ({ ...v, items: v.items.filter((r) => r.id !== current.id) }));
    setSelectedId(rest[0]?.id ?? '');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-xs">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
          <Icon name="camera" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium text-slate-800">
            Отчётов: {value.items.length}, на сайте — {onSite}
          </p>
          <p className="text-slate-500">Скрытые, без фото и без заголовка на сайт не выводятся.</p>
        </div>
        <Button onClick={add}>
          <Icon name="plus" className="h-4 w-4" />
          Добавить отчёт
        </Button>
        <Button variant="primary" onClick={() => void save()} disabled={!dirty || saving}>
          {saving ? 'Сохраняем…' : dirty ? 'Сохранить' : 'Сохранено'}
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-3">
          <input className="field" type="search" placeholder="Поиск: оборудование, город…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="flex flex-wrap gap-1.5">
            {['', ...years].map((y) => (
              <button
                key={y || 'all'}
                type="button"
                onClick={() => setYear(y)}
                className={cx('rounded-full border px-3 py-1 text-xs font-medium transition', year === y ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')}
              >
                {y || 'Все годы'}
              </button>
            ))}
          </div>
          <ul className="max-h-[calc(100vh-260px)] space-y-2 overflow-y-auto pr-1">
            {shown.map((r) => {
              const problem = problemOf(r);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={cx(
                      'flex w-full items-center gap-3 rounded-xl border bg-white p-2.5 text-left shadow-xs transition',
                      r.id === selectedId ? 'border-brand-500 ring-3 ring-brand-100' : 'border-slate-200 hover:border-slate-300',
                      problem && 'opacity-70',
                    )}
                  >
                    {r.photos[0] ? (
                      <img src={fileSrc(`${r.photos[0].src}?w=160`)} alt="" className="h-14 w-20 shrink-0 rounded-md bg-slate-100 object-cover" />
                    ) : (
                      <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 text-[10px] text-slate-400">нет фото</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-semibold text-slate-800">{r.title || 'Без заголовка'}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {photoReportMonth(r.date)}
                        {r.region ? ` · ${r.region}` : ''}
                      </span>
                      <span className="block truncate text-xs text-slate-400">
                        {PHOTO_REPORT_KINDS[r.kind]} · фото {r.photos.length}
                        {r.videos.length ? ` · видео ${r.videos.length}` : ''}
                      </span>
                    </span>
                    {problem && <Badge tone={problem === 'скрыт' ? 'gray' : 'amber'}>{problem}</Badge>}
                  </button>
                </li>
              );
            })}
            {!shown.length && <li className="px-1 py-6 text-center text-sm text-slate-400">Ничего не найдено</li>}
          </ul>
        </div>

        {current ? (
          <ReportForm key={current.id} r={current} regions={regions} siteUrl={siteUrl} published={saved.includes(`"id":"${current.id}"`)} onChange={update} onRemove={remove} />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Отчётов пока нет — добавьте первый.</div>
        )}
      </div>
    </div>
  );
}

function ReportForm({
  r,
  regions,
  siteUrl,
  published,
  onChange,
  onRemove,
}: {
  r: PhotoReport;
  regions: string[];
  siteUrl: string;
  published: boolean;
  onChange: (patch: Partial<PhotoReport>) => void;
  onRemove: () => void;
}) {
  const place = photoReportPlace(r);
  return (
    <div className="min-w-0 space-y-5">
      <Card
        title="Отчёт"
        actions={
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={!r.hidden} onChange={(e) => onChange({ hidden: !e.target.checked })} />
            Показывать на сайте
          </label>
        }
      >
        <div className="grid gap-4 md:grid-cols-[200px_200px_minmax(0,1fr)]">
          <Field label="Что было">
            <select className="field" value={r.kind} onChange={(e) => onChange({ kind: e.target.value as PhotoReportKind })}>
              {(Object.keys(PHOTO_REPORT_KINDS) as PhotoReportKind[]).map((k) => (
                <option key={k} value={k}>
                  {PHOTO_REPORT_KINDS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Дата" hint={`На сайте — «${photoReportMonth(r.date)}»`}>
            <input type="date" className="field" value={r.date} onChange={(e) => e.target.value && onChange({ date: e.target.value })} />
          </Field>
          <Field label="Заголовок" hint="Коротко: что и куда — «Отгрузка индукционной печи 500 кг в Курган»">
            <input className="field" value={r.title} onChange={(e) => onChange({ title: e.target.value })} />
          </Field>
          <Field label="Регион" hint="На плашке фото: «Курганская область»" className="md:col-span-2">
            <input className="field" list="photo-report-regions" value={r.region} onChange={(e) => onChange({ region: e.target.value })} />
            <datalist id="photo-report-regions">
              {regions.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </Field>
          <Field label="Город" hint="В окне отчёта после региона: «г. Курган»">
            <input className="field" value={r.city} onChange={(e) => onChange({ city: e.target.value })} />
          </Field>
        </div>
        <Field label="Описание" hint={`Показывается в окне отчёта; в карточке — начало. Абзацы — через пустую строку. ${r.text.length} знаков`} className="mt-4">
          <textarea className="field min-h-36" rows={6} value={r.text} onChange={(e) => onChange({ text: e.target.value })} />
        </Field>
        <p className="mt-3 text-xs text-slate-500">
          Плашка на фото: «{photoReportMonth(r.date)}
          {r.region ? ` · ${r.region}` : ''}»{place ? ` · в окне: ${place}` : ''}
          {published && !r.hidden && r.photos.length ? (
            <>
              {' · '}
              <a className="text-brand-600 hover:underline" href={`${siteUrl}/proekty/#otchet-${r.id}`} target="_blank" rel="noreferrer">
                открыть на сайте
              </a>
            </>
          ) : null}
        </p>
      </Card>

      <Card title="Фото">
        <GalleryField
          value={r.photos}
          label="Фото — 1–5 лучших кадров; первое — обложка карточки (лучше горизонтальное)"
          folder={`${folderOf(r)}`}
          onChange={(photos) => onChange({ photos: photos.map((p) => ({ src: p.src, alt: p.alt })) })}
        />
      </Card>

      <Card title="Видео">
        <VideosField videos={r.videos} folder={folderOf(r)} onChange={(videos) => onChange({ videos })} />
      </Card>

      <div className="flex justify-end">
        <Button variant="danger" size="sm" onClick={onRemove}>
          <Icon name="trash" className="h-4 w-4" />
          Удалить отчёт
        </Button>
      </div>
    </div>
  );
}

/** Видео отчёта: MP4 до 50 МБ, обложка — кадр из видео (делается сам), порядок — стрелками. */
function VideosField({ videos, folder, onChange }: { videos: PhotoReportVideo[]; folder: string; onChange: (v: PhotoReportVideo[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState('');
  const move = (from: number, to: number) => {
    if (to < 0 || to >= videos.length) return;
    const next = [...videos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  async function upload(files: FileList) {
    const added: PhotoReportVideo[] = [];
    for (const file of [...files]) {
      if (!/^video\/(mp4|webm)$/.test(file.type)) {
        toast.error(`${file.name}: нужен MP4 (H.264) или WebM`);
        continue;
      }
      if (file.size > VIDEO_MAX) {
        toast.error(`${file.name}: больше 50 МБ — сожмите видео или обрежьте`);
        continue;
      }
      try {
        setBusy(`Загрузка ${file.name}…`);
        const src = await uploadFile(folder, file);
        setBusy('Кадр для обложки…');
        const frame = await capturePoster(fileSrc(src));
        const poster = frame ? await uploadFile(folder, new File([frame], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' })) : '';
        added.push({ src, poster });
      } catch (err) {
        toast.error(err);
      }
    }
    setBusy('');
    if (added.length) {
      onChange([...videos, ...added]);
      toast.ok(`Добавлено видео: ${added.length}`);
    }
  }

  return (
    <div className="space-y-3">
      {videos.map((v, i) => (
        <div key={`${v.src}-${i}`} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5">
          {v.poster ? (
            <img src={fileSrc(`${v.poster}?w=160`)} alt="" className="h-14 w-24 shrink-0 rounded-md bg-slate-900 object-cover" />
          ) : (
            <span className="flex h-14 w-24 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
              <Icon name="video" className="h-5 w-5" />
            </span>
          )}
          <a className="min-w-0 flex-1 truncate text-sm text-brand-600 hover:underline" href={fileSrc(v.src)} target="_blank" rel="noreferrer">
            {v.src.split('/').pop()}
          </a>
          <span className="flex gap-1 text-slate-500">
            <button type="button" className="rounded p-1 hover:bg-slate-100" title="Выше" aria-label="Выше" onClick={() => move(i, i - 1)}>
              <Icon name="up" className="h-4 w-4" />
            </button>
            <button type="button" className="rounded p-1 hover:bg-slate-100" title="Ниже" aria-label="Ниже" onClick={() => move(i, i + 1)}>
              <Icon name="down" className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded p-1 hover:bg-slate-100 hover:text-red-600"
              title="Убрать видео"
              aria-label="Убрать видео"
              onClick={() => window.confirm('Убрать видео из отчёта? Файл останется в медиатеке.') && onChange(videos.filter((_, j) => j !== i))}
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </span>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="primary" disabled={Boolean(busy)} onClick={() => input.current?.click()}>
          <Icon name="video" className="h-4 w-4" />
          {busy || 'Загрузить видео'}
        </Button>
        <span className="text-xs text-slate-500">MP4 до 50 МБ; на сайте — после фото, со своим плеером. Обложка — кадр из видео.</span>
      </div>
      <input ref={input} type="file" accept="video/mp4,video/webm" multiple hidden onChange={(e) => e.target.files && void upload(e.target.files)} />
    </div>
  );
}
