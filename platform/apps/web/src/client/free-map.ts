import { $$ } from './dom';

/**
 * Карта без рекламы: Leaflet и плитки OpenStreetMap (бесплатно, без ключа, подпись источника обязательна).
 * Блок: <div class="free-map" data-free-map='[{"name":"Миасс","ll":[55.13,60.14],"note":"адрес","main":true}]'>.
 * Контакты: одна точка и масштаб (data-zoom), рядом своя метка страницы .kz-map__pin — её текст переводит словарь сайта.
 * Библиотека грузится, когда карта подходит к экрану. Колесо мыши карту не приближает: страница должна листаться.
 */
interface Marker {
  name: string;
  ll: [number, number];
  note?: string;
  main?: boolean;
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

async function mount(el: HTMLElement): Promise<void> {
  const markers = JSON.parse(el.dataset.freeMap ?? '[]') as Marker[];
  const [{ default: L }, { default: css }] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
  if (!document.getElementById('leaflet-css')) {
    const style = document.createElement('style');
    style.id = 'leaflet-css';
    style.textContent = css;
    document.head.append(style);
  }
  const map = L.map(el, { scrollWheelZoom: false, attributionControl: false, zoomControl: false, zoomSnap: 0.25, minZoom: 1 });
  L.control.zoom({ position: 'topright' }).addTo(map);
  // подпись источника обязательна: слева внизу её не закрывает кнопка «Наверх»
  L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(map);

  // своя метка лежит над картой и щитом: держим её над точкой, когда карту двигают
  const own = el.parentElement?.querySelector<HTMLElement>('.kz-map__pin');
  if (own) {
    const ll = markers[0]!.ll;
    map.setView(ll, Number(el.dataset.zoom ?? 16), { animate: false });
    const place = () => {
      const p = map.latLngToContainerPoint(ll);
      own.style.left = `${p.x}px`;
      own.style.top = `${p.y}px`;
    };
    map.on('move zoom zoomend resize', place);
    place();
    // щит: пока карту не нажали, колесо и палец листают страницу
    const wrap = own.closest('.kz-map');
    wrap?.querySelector('.kz-map__lock')?.addEventListener('click', () => wrap.classList.add('is-active'));
    wrap?.addEventListener('mouseleave', () => wrap.classList.remove('is-active'));
    return;
  }

  for (const m of markers) {
    const html = `<span class="free-map__pin${m.main ? ' is-main' : ''}"><span class="free-map__dot"></span>${escapeHtml(m.name)}</span>`;
    const marker = L.marker(m.ll, { title: m.name, zIndexOffset: m.main ? 1000 : 0, icon: L.divIcon({ className: 'free-map__marker', html, iconSize: [0, 0] }) }).addTo(map);
    if (m.note) marker.bindPopup(`<b>${escapeHtml(m.name)}</b><br>${escapeHtml(m.note)}`);
  }

  // соседние города на этом масштабе: подпись справа, если там занято — слева, если и там — только точка (название — по щелчку)
  const arrange = () => {
    const placed: DOMRect[] = [];
    const free = (pin: HTMLElement) => {
      const box = pin.getBoundingClientRect();
      const frame = el.getBoundingClientRect();
      if (box.left < frame.left + 2 || box.right > frame.right - 2) return false;
      return !placed.some((p) => box.left < p.right + 4 && box.right > p.left - 4 && box.top < p.bottom + 2 && box.bottom > p.top - 2);
    };
    for (const pin of $$<HTMLElement>('.free-map__pin', el)) {
      pin.classList.remove('is-dot', 'is-left');
      if (!free(pin)) {
        pin.classList.add('is-left');
        if (!free(pin)) {
          pin.classList.remove('is-left');
          pin.classList.add('is-dot');
        }
      }
      placed.push(pin.getBoundingClientRect());
    }
  };
  map.on('zoomend', arrange);

  // панель текста лежит поверх карты: метки — в свободной части
  const panel = el.closest('section')?.querySelector<HTMLElement>('.geo__panel');
  const box = el.getBoundingClientRect();
  const over = panel ? panel.getBoundingClientRect() : null;
  const covered = over && over.top < box.bottom && over.bottom > box.top ? Math.max(0, over.right - box.left) : 0;
  map.fitBounds(L.latLngBounds(markers.map((m) => m.ll)), { paddingTopLeft: [covered + 24, 40], paddingBottomRight: [Math.min(125, box.width * 0.27), 40], animate: false });
  arrange();
}

for (const el of $$<HTMLElement>('[data-free-map]')) {
  if (!('IntersectionObserver' in window)) {
    void mount(el);
    continue;
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      void mount(el);
    },
    { rootMargin: '400px' },
  );
  io.observe(el);
}
