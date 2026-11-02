import { appendAnalytics, getMarketing, reachGoal, refreshYmClientId } from '@mtpk/ui/browser/marketing';
import { clearQuoteItems, getQuoteItems, mergeTaskText, subscribeQuote } from '@mtpk/ui/browser/quote-store';
import { $, $$ } from './dom';
import { localized } from './i18n';

/**
 * Формы заявок: все формы с data-form (и старые .js-lead-form из блоков
 * «HTML как есть»). Антиспам-поля, источник, метки рекламы, трейс Битрикс24,
 * повторная отправка с тем же request_id (без дублей в CRM), вложение до
 * 10 МБ, статус для скринридеров, цель Метрики, переход на /спасибо/.
 */
const ENDPOINT = '/api/send.php';
const MAX_FILE = 10 * 1024 * 1024;
const PHONE_FALLBACK = 'Позвоните: +7 (775) 853-40-95';
type StatusType = 'pending' | 'success' | 'error';

function showStatus(el: HTMLElement | null, type: StatusType, message: string): void {
  if (!el) {
    if (type !== 'pending' && message) window.alert(message);
    return;
  }
  el.textContent = message;
  el.className = `js-form-status form-status form-status--${type}`;
  el.hidden = !message;
  el.style.display = message ? 'block' : 'none';
  if (type === 'error' && message) {
    el.setAttribute('tabindex', '-1');
    el.focus();
  }
}

/**
 * Пропуск на страницу «Спасибо» на 15 минут: открытая без заявки /spasibo/ — «не найдена» (proxy.ts).
 * Cookie без личных данных, только для /spasibo/.
 */
function allowThanksPage(): void {
  document.cookie = `ui_lead_sent=1; Max-Age=900; Path=${localized('/spasibo/')}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
}

function randomId(): string | null {
  if (!window.crypto?.getRandomValues) return null;
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * «Прикрепить файл»: имя файла на кнопке (или в элементе [data-file-name]
 * зоны файла), лимит 10 МБ. Зона файла принимает и перетаскивание: поле
 * выбора файла лежит поверх неё, на время перетаскивания — класс is-dragover.
 */
function fileField(form: HTMLFormElement, status: HTMLElement | null) {
  const input = $<HTMLInputElement>('input[type="file"]', form);
  const label = input?.closest('label');
  const named = label?.querySelector('[data-file-name]');
  const textNode = named ?? (label ? Array.from(label.childNodes).find((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) : undefined);
  if (!input || !label || !textNode) return { file: () => input?.files?.[0] };
  if (named) {
    const over = (on: boolean) => () => label.classList.toggle('is-dragover', on);
    input.addEventListener('dragenter', over(true));
    input.addEventListener('dragleave', over(false));
    input.addEventListener('drop', over(false));
  }
  const defaultText = textNode.textContent ?? '';
  const reset = () => {
    textNode.textContent = defaultText;
    label.classList.remove('is-attached');
  };
  input.addEventListener('change', () => {
    let f = input.files?.[0];
    if (f && f.size > MAX_FILE) {
      input.value = '';
      f = undefined;
      showStatus(status, 'error', 'Файл больше 10 МБ — приложите файл поменьше');
    }
    if (!f) return reset();
    const name = f.name.length > 28 ? `${f.name.slice(0, 15)}…${f.name.slice(-9)}` : f.name;
    textNode.textContent = ` ${name}`;
    label.classList.add('is-attached');
  });
  return { file: () => input.files?.[0] };
}

function initForm(form: HTMLFormElement, index: number): void {
  if (form.dataset.ready) return;
  form.dataset.ready = '1';
  const status = $('.js-form-status', form);
  const phone = $<HTMLInputElement>('[name="phone"]', form);
  if (status) {
    if (!status.id) status.id = `ui-form-status-${index}`;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    if (phone) phone.setAttribute('aria-describedby', `${phone.getAttribute('aria-describedby') ?? ''} ${status.id}`.trim());
  }
  const ts = $<HTMLInputElement>('.js-form-ts', form);
  if (ts) ts.value = String(Date.now());
  const src = $<HTMLInputElement>('.js-form-source', form);
  const formName = form.getAttribute('data-form') ?? '';
  if (src && !src.value) src.value = `${formName ? `${formName} · ` : ''}${location.pathname}`;

  // «Запросить цену»: накопленные позиции — в поле «Задача»
  const task = $<HTMLTextAreaElement>('textarea[name="task"]', form);
  if (task) {
    const sync = (items: string[]) => {
      task.value = mergeTaskText(task.value, items);
    };
    sync(getQuoteItems());
    subscribeQuote(sync);
  }

  const files = fileField(form, status);
  const loadedAt = Date.now();
  let submitting = false;
  let requestId = '';
  let fingerprint = '';
  let goalFor = '';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (submitting) return;
    if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;
    if (phone && phone.value.replace(/\D/g, '').length < 6) {
      phone.setAttribute('aria-invalid', 'true');
      showStatus(status, 'error', 'Укажите корректный телефон');
      phone.focus();
      return;
    }
    phone?.removeAttribute('aria-invalid');

    const fd = new FormData(form);
    const file = files.file();
    let fp = ['phone', 'name', 'email', 'task', 'message', 'part', 'model', 'quantity', 'source', 'consent'].map((k) => String(fd.get(k) ?? '')).join('\n');
    if (file) fp += `\n${file.name}:${file.size}:${file.lastModified}`;
    // повтор той же заявки — тот же request_id: сервис не создаст дубль
    if (!requestId || fp !== fingerprint) {
      const id = randomId();
      if (!id) return showStatus(status, 'error', `Браузер не поддерживает защищённую отправку. ${PHONE_FALLBACK}`);
      requestId = id;
      fingerprint = fp;
    }
    fd.set('request_id', requestId);
    for (const [k, v] of Object.entries(getMarketing())) if (v) fd.append(k, v);
    appendAnalytics(fd);

    const button = $<HTMLButtonElement>('[type="submit"]', form);
    const buttonHtml = button?.innerHTML ?? '';
    if (button) {
      button.disabled = true;
      button.innerHTML = 'Отправляем…';
    }
    showStatus(status, 'pending', '');
    submitting = true;
    form.setAttribute('aria-busy', 'true');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 65_000);
    // автозаполнение может опередить антиспам-порог (3 с) — дожидаемся его
    const wait = Math.min(3100, Math.max(0, 3100 - (Date.now() - loadedAt)));

    void new Promise((r) => setTimeout(r, wait))
      .then(() => fetch(ENDPOINT, { method: 'POST', body: fd, signal: controller.signal, headers: { Accept: 'application/json' } }))
      .then(async (res) => {
        if (!(res.headers.get('Content-Type') ?? '').toLowerCase().includes('application/json')) throw new Error('bad response');
        const data = (await res.json()) as { ok?: unknown; message?: unknown; receipt?: unknown; delivery?: unknown };
        if (typeof data.ok !== 'boolean' || typeof data.message !== 'string') throw new Error('bad response');
        if (!data.ok) return showStatus(status, 'error', data.message || `Не удалось отправить. ${PHONE_FALLBACK}`);
        if (!res.ok || data.receipt !== requestId || !['delivered', 'queued'].includes(String(data.delivery))) throw new Error('unconfirmed');
        if (goalFor !== requestId) {
          reachGoal(formName);
          goalFor = requestId;
        }
        clearQuoteItems();
        if (data.delivery === 'queued') {
          // доставка в CRM ещё не подтверждена — остаёмся на странице
          return showStatus(status, 'success', data.message);
        }
        try {
          sessionStorage.setItem('ui_lead_confirmed_phone', phone ? phone.value.trim() : '');
        } catch {
          /* приватный режим */
        }
        allowThanksPage();
        showStatus(status, 'success', 'Заявка отправлена! Переходим…');
        window.location.assign(localized('/spasibo/'));
      })
      .catch(() =>
        showStatus(status, 'error', `Не удалось получить подтверждение отправки. Данные сохранены в форме — попробуйте ещё раз. ${PHONE_FALLBACK}`),
      )
      .finally(() => {
        window.clearTimeout(timeout);
        submitting = false;
        form.removeAttribute('aria-busy');
        if (button) {
          button.disabled = false;
          button.innerHTML = buttonHtml;
        }
      });
  });
}

export function initForms(): void {
  const forms = $$<HTMLFormElement>('form[data-form], form.js-lead-form');
  if (!forms.length) return;
  getMarketing(); // зафиксировать первое касание сразу при загрузке страницы
  window.setTimeout(refreshYmClientId, 3000);
  window.addEventListener('cookie-consent-accepted', refreshYmClientId);
  forms.forEach(initForm);
}
