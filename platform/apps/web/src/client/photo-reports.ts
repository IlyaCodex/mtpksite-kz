import { $, $$, reducedMotion } from './dom';
import { setImage } from './images';

/**
 * Фотоотчёты с объектов (блок photoReports, разметка — packages/ui/src/blocks/PhotoReports.tsx):
 * кнопки годов, выбор региона (его отчёты — первыми, затем остальные), подгрузка по pageSize карточек
 * при прокрутке до конца списка, окно <dialog> с каруселью фото и видео — стрелки, квадратные миниатюры,
 * клавиши ←/→, свайп; кадр вписан в окно целиком. Видео — свой плеер: запуск, перемотка, звук, весь экран.
 * Ссылка …#otchet-<id> открывает отчёт сразу. Оформление — styles/photo-reports.css.
 */
interface Report {
  id: string;
  kind: string;
  date: string;
  place: string;
  title: string;
  text: string;
  photos: { src: string; alt: string }[];
  videos: { src: string; poster: string }[];
}
type Slide = { kind: 'photo'; src: string; alt: string } | { kind: 'video'; src: string; poster: string };

/** Столько же, сколько CSS-переход окна (--duration-base). */
const CLOSE_MS = 250;
const HASH = /^#otchet-([a-z0-9-]+)$/;

const icon = (d: string, solid = false) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" ${solid ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'}><path d="${d}"/></svg>`;
const ICONS = {
  play: icon('M8 5.3v13.4L18.6 12z', true),
  pause: icon('M6.8 5h3.6v14H6.8zM13.6 5h3.6v14h-3.6z', true),
  sound: icon('M3.5 9.5v5h3.6l4.9 4v-13l-4.9 4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.6 7.6 0 0 1 0 11'),
  muted: icon('M3.5 9.5v5h3.6l4.9 4v-13l-4.9 4zM16 9.5l5 5M21 9.5l-5 5'),
  full: icon('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'),
};

const clock = (s: number) => {
  const t = Math.max(0, Math.floor(Number.isFinite(s) ? s : 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/** Свой плеер видео: большая кнопка запуска, панель (запуск/пауза, время, перемотка, звук, весь экран). */
function videoPlayer(slide: Extract<Slide, { kind: 'video' }>, title: string): { el: HTMLElement; stop: () => void } {
  const el = document.createElement('div');
  el.className = 'report-video is-paused';
  el.innerHTML = `<video class="report-video__media" preload="metadata" playsinline></video>
<button type="button" class="report-video__big" aria-label="Смотреть видео">${ICONS.play}</button>
<div class="report-video__bar">
  <button type="button" class="report-video__btn" data-v="play" aria-label="Смотреть">${ICONS.play}</button>
  <span class="report-video__time"><span data-v="now">0:00</span> / <span data-v="dur">0:00</span></span>
  <input type="range" class="report-video__seek" min="0" max="1000" step="1" value="0" aria-label="Перемотка">
  <button type="button" class="report-video__btn" data-v="mute" aria-label="Выключить звук">${ICONS.sound}</button>
  <button type="button" class="report-video__btn" data-v="full" aria-label="На весь экран">${ICONS.full}</button>
</div>`;
  const video = $<HTMLVideoElement>('video', el)!;
  video.src = slide.src;
  video.setAttribute('aria-label', title);
  // плеер — по пропорциям ролика (стили: --ar, по умолчанию вертикальный 9:16): сначала по обложке, потом по самому видео
  const fitTo = (w: number, h: number) => w && h && el.style.setProperty('--ar', (w / h).toFixed(4));
  if (slide.poster) {
    video.poster = slide.poster;
    const shot = new Image();
    shot.addEventListener('load', () => fitTo(shot.naturalWidth, shot.naturalHeight), { once: true });
    shot.src = slide.poster;
  }
  video.addEventListener('loadedmetadata', () => fitTo(video.videoWidth, video.videoHeight), { once: true });
  const play = $<HTMLButtonElement>('[data-v="play"]', el)!;
  const mute = $<HTMLButtonElement>('[data-v="mute"]', el)!;
  const seek = $<HTMLInputElement>('.report-video__seek', el)!;
  const now = $('[data-v="now"]', el)!;
  const dur = $('[data-v="dur"]', el)!;
  let idle = 0;

  const toggle = () => (video.paused || video.ended ? void video.play().catch(() => undefined) : video.pause());
  // панель прячется, пока видео идёт и мышь не двигается
  const wake = () => {
    el.classList.remove('is-idle');
    window.clearTimeout(idle);
    if (!video.paused) idle = window.setTimeout(() => el.classList.add('is-idle'), 2500);
  };
  const paint = () => {
    const playing = !video.paused && !video.ended;
    el.classList.toggle('is-paused', !playing);
    play.innerHTML = playing ? ICONS.pause : ICONS.play;
    play.setAttribute('aria-label', playing ? 'Пауза' : 'Смотреть');
    wake();
  };
  const time = () => {
    now.textContent = clock(video.currentTime);
    if (video.duration) seek.value = String(Math.round((video.currentTime / video.duration) * 1000));
  };

  $('.report-video__big', el)!.addEventListener('click', toggle);
  play.addEventListener('click', toggle);
  video.addEventListener('click', toggle);
  video.addEventListener('play', paint);
  video.addEventListener('pause', paint);
  video.addEventListener('ended', paint);
  video.addEventListener('timeupdate', time);
  video.addEventListener('loadedmetadata', () => {
    dur.textContent = clock(video.duration);
    time();
  });
  seek.addEventListener('input', () => {
    if (video.duration) video.currentTime = (Number(seek.value) / 1000) * video.duration;
  });
  mute.addEventListener('click', () => {
    video.muted = !video.muted;
    mute.innerHTML = video.muted ? ICONS.muted : ICONS.sound;
    mute.setAttribute('aria-label', video.muted ? 'Включить звук' : 'Выключить звук');
  });
  $('[data-v="full"]', el)!.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (el.requestFullscreen) void el.requestFullscreen().catch(() => undefined);
    // iPhone: на весь экран только само видео
    else (video as HTMLVideoElement & { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen?.();
  });
  el.addEventListener('pointermove', wake);
  return {
    el,
    stop: () => {
      window.clearTimeout(idle);
      video.pause();
    },
  };
}

function initSection(section: HTMLElement): void {
  const data = $('.photo-reports__data', section);
  const found = $<HTMLDialogElement>('.report-modal', section);
  if (!data || !found) return;
  const dialog: HTMLDialogElement = found;
  const reports = JSON.parse(data.textContent || '[]') as Report[];
  const pageSize = Number(section.dataset.pageSize) || 8;
  const grid = $('.photo-reports__grid', section)!;
  let cards = $$<HTMLElement>('.report-card', section);
  const sentinel = $('[data-reports-sentinel]', section);
  const regionBox = $('[data-report-regions]', section);
  const region = $<HTMLSelectElement>('[data-report-region]', section);
  let year = '';
  let shown = pageSize;

  /** Карточки выбранного года: первые shown видны; пока есть скрытые — метка подгрузки под сеткой. */
  function apply(): void {
    const match = cards.filter((c) => !year || c.dataset.year === year);
    for (const c of cards) c.hidden = true;
    match.slice(0, shown).forEach((c) => (c.hidden = false));
    if (sentinel) sentinel.hidden = match.length <= shown;
  }

  /** Отчёты выбранного региона — первыми, затем остальные; внутри — по дате (data-order — порядок «новые сверху»). */
  function sortByRegion(): void {
    const regions = new Set(region?.selectedOptions[0]?.dataset.regions?.split('|') ?? []);
    const rank = (c: HTMLElement) => (regions.has(c.dataset.region ?? '') ? 0 : 1);
    cards = [...cards].sort((a, b) => rank(a) - rank(b) || Number(a.dataset.order) - Number(b.dataset.order));
    grid.append(...cards);
  }

  for (const btn of $$<HTMLButtonElement>('.photo-reports__year', section)) {
    btn.addEventListener('click', () => {
      year = btn.dataset.year ?? '';
      shown = pageSize;
      for (const b of $$<HTMLButtonElement>('.photo-reports__year', section)) {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      }
      apply();
    });
  }
  region?.addEventListener('change', () => {
    sortByRegion();
    shown = pageSize;
    apply();
  });
  // продолжение раздела: выбор региона — справа от заголовка раздела выше (нет его — в строке годов)
  if (regionBox?.hidden) {
    const heading = [...(section.previousElementSibling?.querySelectorAll('h2') ?? [])].pop();
    (heading?.parentElement ?? $('.photo-reports__head', section))?.append(regionBox);
    regionBox.hidden = false;
  }
  // подгрузка: метка под сеткой подошла к экрану — ещё pageSize карточек
  if (sentinel && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (sentinel.hidden || !entries.some((e) => e.isIntersecting)) return;
        shown += pageSize;
        apply();
        // экран высокий и метка всё ещё рядом — проверить ещё раз
        io.unobserve(sentinel);
        io.observe(sentinel);
      },
      { rootMargin: '0px 0px 400px 0px' },
    );
    io.observe(sentinel);
  } else if (sentinel) shown = cards.length;

  // ── окно отчёта ──
  const stage = $('[data-stage]', dialog)!;
  const frame = $('[data-frame]', dialog)!;
  const thumbs = $('[data-thumbs]', dialog)!;
  const counter = $('[data-counter]', dialog)!;
  const navs = $$<HTMLButtonElement>('[data-step]', dialog);
  let slides: Slide[] = [];
  let index = 0;
  let current: Report | null = null;
  let stopVideo: (() => void) | null = null;

  function show(i: number): void {
    stopVideo?.();
    stopVideo = null;
    index = (i + slides.length) % slides.length;
    const s = slides[index];
    if (s.kind === 'photo') {
      const img = document.createElement('img');
      img.className = 'report-modal__img';
      img.alt = s.alt || current?.title || '';
      img.decoding = 'async';
      stage.classList.add('is-loading');
      img.addEventListener('load', () => stage.classList.remove('is-loading'), { once: true });
      img.addEventListener('error', () => stage.classList.remove('is-loading'), { once: true });
      setImage(img, s.src, 'report-modal__img');
      frame.replaceChildren(img);
    } else {
      stage.classList.remove('is-loading');
      const player = videoPlayer(s, current?.title ?? '');
      stopVideo = player.stop;
      frame.replaceChildren(player.el);
    }
    counter.textContent = `${index + 1} / ${slides.length}`;
    $$<HTMLButtonElement>('button', thumbs).forEach((b, j) => {
      b.classList.toggle('is-active', j === index);
      b.setAttribute('aria-current', String(j === index));
    });
    const active = thumbs.children[index] as HTMLElement | undefined;
    if (active) thumbs.scrollTo({ left: active.offsetLeft - (thumbs.clientWidth - active.offsetWidth) / 2, behavior: reducedMotion() ? 'auto' : 'smooth' });
    // следующий кадр — заранее
    const next = slides[(index + 1) % slides.length];
    if (next.kind === 'photo' && slides.length > 1) setImage(new Image(), next.src, 'report-modal__img');
  }

  function open(n: number): void {
    const r = reports[n];
    if (!r) return;
    current = r;
    slides = [...r.photos.map((p): Slide => ({ kind: 'photo', ...p })), ...r.videos.map((v): Slide => ({ kind: 'video', ...v }))];
    $('[data-kind]', dialog)!.textContent = r.kind;
    $('[data-title]', dialog)!.textContent = r.title;
    $('[data-date]', dialog)!.textContent = r.date;
    $('[data-place]', dialog)!.textContent = r.place;
    $('[data-place-row]', dialog)!.hidden = !r.place;
    $('[data-text]', dialog)!.replaceChildren(
      ...r.text
        .split(/\n\s*\n/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => Object.assign(document.createElement('p'), { textContent: t })),
    );
    thumbs.replaceChildren(
      ...slides.map((s, j) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `report-modal__thumb${s.kind === 'video' ? ' report-modal__thumb--video' : ''}`;
        b.setAttribute('aria-label', s.kind === 'video' ? `Видео ${j + 1 - r.photos.length}` : `Фото ${j + 1}`);
        const src = s.kind === 'photo' ? s.src : s.poster;
        if (src) {
          const img = document.createElement('img');
          img.alt = '';
          img.loading = 'lazy';
          setImage(img, src, 'report-modal__thumb');
          b.append(img);
        }
        if (s.kind === 'video') b.insertAdjacentHTML('beforeend', `<span class="report-modal__thumb-play">${ICONS.play}</span>`);
        b.addEventListener('click', () => show(j));
        return b;
      }),
    );
    const single = slides.length < 2;
    thumbs.hidden = single;
    counter.hidden = single;
    for (const b of navs) b.hidden = single;
    show(0);
    if (!dialog!.open) {
      dialog!.showModal();
      requestAnimationFrame(() => requestAnimationFrame(() => dialog!.classList.add('is-open')));
    }
    $<HTMLButtonElement>('.report-modal__close', dialog)?.focus();
    history.replaceState(history.state, '', `${location.pathname}${location.search}#otchet-${r.id}`);
  }

  function close(): void {
    stopVideo?.();
    stopVideo = null;
    if (HASH.test(location.hash)) history.replaceState(history.state, '', `${location.pathname}${location.search}`);
    if (!dialog!.open) return;
    dialog!.classList.remove('is-open');
    window.setTimeout(() => dialog!.close(), reducedMotion() ? 0 : CLOSE_MS);
  }

  for (const btn of $$<HTMLButtonElement>('.report-card__open', section)) btn.addEventListener('click', () => open(Number(btn.dataset.report)));
  for (const b of navs) b.addEventListener('click', () => show(index + Number(b.dataset.step)));
  for (const b of $$('[data-report-close]', dialog)) b.addEventListener('click', close);
  // «Обсудить похожий проект»: окно закрывается сразу (фокус возвращается к карточке), затем — к форме заявки
  $('[data-report-cta]', dialog)?.addEventListener('click', (e) => {
    const form = document.getElementById('leadgen');
    if (!form) return;
    e.preventDefault();
    stopVideo?.();
    stopVideo = null;
    dialog.classList.remove('is-open');
    dialog.close();
    history.replaceState(history.state, '', `${location.pathname}${location.search}#leadgen`);
    form.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  });
  // Esc — тоже плавно
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  // щелчок по затемнению вокруг окна
  dialog.addEventListener('click', (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
  });
  dialog.addEventListener('keydown', (e) => {
    if (slides.length < 2 || (e.target as HTMLElement).matches('input')) return;
    if (e.key === 'ArrowLeft') show(index - 1);
    else if (e.key === 'ArrowRight') show(index + 1);
  });
  // свайп по кадру (не по панели видео)
  let startX = 0;
  let startY = 0;
  stage.addEventListener('pointerdown', (e) => {
    startX = e.clientX;
    startY = e.clientY;
  });
  stage.addEventListener('pointerup', (e) => {
    const dx = e.clientX - startX;
    if (slides.length < 2 || (e.target as HTMLElement).closest('.report-video__bar') || Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(e.clientY - startY)) return;
    show(index + (dx < 0 ? 1 : -1));
  });

  apply();
  // ссылка на отчёт: …/proekty/#otchet-<id>
  const linked = HASH.exec(location.hash)?.[1];
  const at = linked ? reports.findIndex((r) => r.id === linked) : -1;
  if (at >= 0) open(at);
}

for (const section of $$('[data-photo-reports]')) initSection(section);
