/* Обработка форм заявок — УралИндуктор
 * Все формы с классом .js-lead-form отправляются на /api/send.php через fetch.
 * Защита: honeypot (.hp-field), form_ts (время загрузки), source (URL).
 */
type Marketing = Record<string, string>;
type StatusType = 'pending' | 'success' | 'error';

(function () {
  'use strict';

  var ENDPOINT = '/api/send.php';
  var YM_LEGACY_COUNTER = 25228307;        // рекламный кабинет УралИндуктор3
  var YM_UIBUSINESS_COUNTER = 112991420;   // рекламный кабинет uibusiness
  var PRIMARY_YM_COUNTER = YM_UIBUSINESS_COUNTER;
  var TMR_COUNTER = 3784620;   // Top.Mail.Ru
  var forms = document.querySelectorAll<HTMLFormElement>('form.js-lead-form');
  if (!forms.length) return;

  function getCookie(name: string): string {
    var escaped = name.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
    var m = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
    if (!m) return '';
    try { return decodeURIComponent(m[1]); } catch (e) { return ''; }
  }

  // ── UTM / маркетинговые метки ───────────────────────────────
  // Последнее размеченное рекламное касание сохраняем на 30 дней
  // (localStorage + cookie) и добавляем в заявку. Новый визит с любой меткой
  // начинает чистую атрибуцию: отсутствующие click-id не наследуются от
  // предыдущей кампании, landing_url фиксируется заново.
  var UTM_KEY = 'ui_marketing_trace';
  function setCookie(name: string, value: string, days: number) {
    var d = new Date(); d.setTime(d.getTime() + days * 864e5);
    document.cookie = name + '=' + encodeURIComponent(value) +
      ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }
  function getMarketing(): Marketing {
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid', 'gclid', 'fbclid'];
    var saved: Marketing = {};
    try {
      var raw = localStorage.getItem(UTM_KEY) || getCookie(UTM_KEY);
      if (raw) saved = JSON.parse(raw) || {};
    } catch (e) {}
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
    var params: URLSearchParams | null = null;
    try { params = new URLSearchParams(location.search); } catch (e) {}
    var hasIncomingMarketing = false;
    if (params) keys.forEach(function (k) {
      if (params!.get(k)) hasIncomingMarketing = true;
    });

    var data: Marketing = hasIncomingMarketing ? {} : saved;
    var changed = hasIncomingMarketing;
    if (hasIncomingMarketing) {
      keys.forEach(function (k) {
        var v = params!.get(k);
        if (v) data[k] = v.slice(0, 500);
      });
      data.landing_url = location.href.slice(0, 500);
      if (document.referrer && document.referrer.indexOf(location.host) === -1) {
        data.referrer = document.referrer.slice(0, 500);
      }
    } else {
      if (!data.landing_url) {
        data.landing_url = location.href.slice(0, 500);
        changed = true;
      }
      if (!data.referrer && document.referrer && document.referrer.indexOf(location.host) === -1) {
        data.referrer = document.referrer.slice(0, 500);
        changed = true;
      }
    }

    if (changed || !Object.keys(saved).length) {
      try {
        var s = JSON.stringify(data);
        localStorage.setItem(UTM_KEY, s);
        setCookie(UTM_KEY, s, 30);
      } catch (e) {}
    }
    return data;
  }
  getMarketing(); // зафиксировать первое касание сразу при загрузке страницы

  // Динамическая подмена B242YA отключена по запросу владельца.
  // Здесь остаются только поля атрибуции самих заявок.

  // ── Сквозная аналитика Битрикс24 ──────────────────────────────────
  // Полный TRACE берём через официальный API трекера Битрикс24. Cookie
  // b24_trace оставляем только как fallback для старых версий трекера.
  // Client ID берём у рекламного счётчика uibusiness; _ym_uid остаётся
  // fallback, если API Метрики ещё не успел ответить.
  var primaryYmClientId = '';
  function refreshYmClientId() {
    try {
      if (typeof window.ym === 'function') {
        window.ym(PRIMARY_YM_COUNTER, 'getClientID', function (clientId: unknown) {
          if (clientId) primaryYmClientId = String(clientId).slice(0, 100);
        });
      }
    } catch (e) {}
  }
  setTimeout(refreshYmClientId, 3000);
  window.addEventListener('cookie-consent-accepted', refreshYmClientId);

  function appendAnalyticsCookies(fd: FormData) {
    var b24Trace = '';
    try {
      if (window.b24Tracker && window.b24Tracker.guest &&
          typeof window.b24Tracker.guest.getTrace === 'function') {
        b24Trace = window.b24Tracker.guest.getTrace() || '';
      }
    } catch (e) {}
    if (!b24Trace) b24Trace = getCookie('b24_trace');
    if (b24Trace) fd.append('b24_trace', b24Trace);

    refreshYmClientId();
    var ymUid = primaryYmClientId || getCookie('_ym_uid');
    if (ymUid) fd.append('_ym_uid', ymUid);
  }

  // ── Цели аналитики ───────────────────────────────────────────
  // Целей не было вообще: конверсии форм в Метрике не считались.
  // Шлём одну общую цель lead_form_submit и вторую — по имени формы
  // (data-form), чтобы разделить экспресс-звонок и полную заявку.
  function isUiBusinessPaidClick(marketing: Marketing) {
    var campaign = String(marketing.utm_campaign || '').toLowerCase();
    var source = String(marketing.utm_source || '').toLowerCase();
    var medium = String(marketing.utm_medium || '').toLowerCase();
    var yclid = String(marketing.yclid || '');
    return campaign.indexOf('aimarketing_') === 0 &&
      source === 'yandex' && medium === 'cpc' && /^\d{10,40}$/.test(yclid);
  }

  function reachGoal(form: HTMLFormElement) {
    var label = (form.getAttribute('data-form') || 'lead').toLowerCase()
      .replace(/[^a-zа-я0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    var marketing = getMarketing();
    var campaign = String(marketing.utm_campaign || '').toLowerCase();
    var source = String(marketing.utm_source || '').toLowerCase();
    // Кампании, созданные этим рекламным кабинетом, имеют стабильный префикс
    // AImarketing_. Остальные размеченные кампании Яндекс Директа относятся
    // к УралИндуктор3. Органику и прямые заходы не приписываем рекламе.
    var goalCounter = 0;
    // Счётчик uibusiness получает конверсию только после настоящего клика
    // из Директа: тестовые UTM без yclid больше не загрязняют эту цель.
    if (isUiBusinessPaidClick(marketing)) {
      goalCounter = YM_UIBUSINESS_COUNTER;
    } else if (campaign && source === 'yandex') {
      goalCounter = YM_LEGACY_COUNTER;
    }
    try {
      if (goalCounter && typeof window.ym === 'function') {
        window.ym(goalCounter, 'reachGoal', 'lead_form_submit', {
          form: label,
          ad_account: goalCounter === YM_UIBUSINESS_COUNTER ? 'uibusiness' : 'uralinduktor3'
        });
      }
    } catch (e) {}
    try {
      if (window._tmr && typeof window._tmr.push === 'function') {
        window._tmr.push({ type: 'reachGoal', id: TMR_COUNTER, goal: 'lead_form_submit' });
      }
    } catch (e) {}
  }

  forms.forEach(function (form, formIndex) {
    var submitting = false;
    var requestId = '';
    var requestFingerprint = '';
    var goalReceipt = '';
    var loadedAt = Date.now();
    var formStatus = form.querySelector('.js-form-status');
    if (formStatus && typeof formStatus.setAttribute === 'function') {
      if (!formStatus.id) formStatus.id = 'ui-form-status-' + formIndex;
      formStatus.setAttribute('role', 'status');
      formStatus.setAttribute('aria-live', 'polite');
      var phoneField = form.querySelector('[name="phone"]');
      if (phoneField) {
        var describedBy = phoneField.getAttribute('aria-describedby') || '';
        phoneField.setAttribute('aria-describedby', (describedBy + ' ' + formStatus.id).trim());
      }
    }
    // Проставляем timestamp загрузки формы (для time-check на бэке)
    var tsField = form.querySelector<HTMLInputElement>('.js-form-ts');
    if (tsField) tsField.value = String(Date.now());

    // Источник заявки — URL + заголовок формы
    var srcField = form.querySelector<HTMLInputElement>('.js-form-source');
    if (srcField && !srcField.value) {
      var label = form.getAttribute('data-form') || '';
      srcField.value = (label ? label + ' · ' : '') + location.pathname;
    }

    // «Прикрепить КП»: показываем имя выбранного файла на кнопке + лимит 10 МБ
    var fileInput = form.querySelector<HTMLInputElement>('input[type="file"]');
    var fileLabel = fileInput ? fileInput.closest('label') : null;
    var fileTextNode: ChildNode | null = null;
    var fileDefaultText = '';
    if (fileLabel) {
      for (var fi = 0; fi < fileLabel.childNodes.length; fi++) {
        var fnode = fileLabel.childNodes[fi];
        if (fnode.nodeType === 3 && fnode.textContent!.trim()) { fileTextNode = fnode; break; }
      }
    }
    function resetFileBtn() {
      if (!fileTextNode) return;
      fileTextNode.textContent = fileDefaultText;
      if (fileLabel) fileLabel.classList.remove('is-attached');
    }
    if (fileInput && fileTextNode) {
      fileDefaultText = fileTextNode.textContent!;
      fileInput.addEventListener('change', function () {
        var f = fileInput!.files && fileInput!.files[0];
        if (f && f.size > 10 * 1024 * 1024) {
          fileInput!.value = '';
          f = null;
          showStatus(form.querySelector<HTMLElement>('.js-form-status'), 'error',
            'Файл больше 10 МБ — приложите файл поменьше');
        }
        if (f) {
          var nm = f.name;
          if (nm.length > 28) nm = nm.slice(0, 15) + '…' + nm.slice(-9);
          fileTextNode!.textContent = ' ' + nm;
          if (fileLabel) fileLabel.classList.add('is-attached');
        } else {
          resetFileBtn();
        }
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (submitting) return;

      var submitBtn = form.querySelector<HTMLButtonElement>('[type="submit"]');
      var status = form.querySelector<HTMLElement>('.js-form-status');

      // Нативная HTML5-валидация (required, type=email и т.д.) с подсказками браузера.
      // preventDefault её глушит — поэтому вызываем вручную.
      if (typeof form.reportValidity === 'function' && !form.reportValidity()) {
        return;
      }

      // phone обязателен — дополнительная проверка (минимум 6 цифр)
      var phone = form.querySelector<HTMLInputElement>('[name="phone"]');
      if (phone && phone.value.replace(/\D/g, '').length < 6) {
        phone.setAttribute('aria-invalid', 'true');
        showStatus(status, 'error', 'Укажите корректный телефон');
        if (phone.focus) phone.focus();
        return;
      }
      if (phone) phone.removeAttribute('aria-invalid');

      var fd = new FormData(form); // файл «Прикрепить КП» уходит вместе с остальными полями
      var fingerprint = ['phone', 'name', 'email', 'task', 'message', 'part', 'model', 'quantity', 'source', 'consent'].map(function (key) {
        return String(fd.get(key) || '');
      }).join('\n');
      var attached = fileInput && fileInput.files && fileInput.files[0];
      if (attached) fingerprint += '\n' + attached.name + ':' + attached.size + ':' + attached.lastModified;
      if (!requestId || fingerprint !== requestFingerprint) {
        if (!window.crypto || !window.crypto.getRandomValues) {
          showStatus(status, 'error', 'Браузер не поддерживает защищённую отправку. Позвоните: +7 (775) 853-40-95');
          return;
        }
        var bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        requestId = Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
        requestFingerprint = fingerprint;
      }
      fd.set('request_id', requestId);
      // маркетинговые метки (utm_*, yclid, gclid, fbclid, referrer, landing_url)
      var mk = getMarketing();
      Object.keys(mk).forEach(function (k) { if (mk[k]) fd.append(k, mk[k]); });
      appendAnalyticsCookies(fd); // b24_trace + _ym_uid для сквозной аналитики
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.label = submitBtn.innerHTML;
        submitBtn.innerHTML = 'Отправляем…';
      }
      showStatus(status, 'pending', '');
      submitting = true;
      form.setAttribute('aria-busy', 'true');
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 65000);
      // Автозаполнение может завершиться раньше антиспам-порога. Данные не
      // выбрасываем: дожидаемся трёх секунд вместо ложного «успеха».
      var waitMs = Math.min(3100, Math.max(0, 3100 - (Date.now() - loadedAt)));
      new Promise(function (resolve) { setTimeout(resolve, waitMs); })
        .then(function () {
          return fetch(ENDPOINT, { method: 'POST', body: fd, signal: controller.signal,
            headers: { 'Accept': 'application/json' } });
        })
        .then(function (r) {
          if (!(r.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
            throw new Error('Invalid server response');
          }
          return r.json().then(function (data) {
            if (!data || typeof data.ok !== 'boolean' || typeof data.message !== 'string') {
              throw new Error('Invalid server response');
            }
            if (data.ok && (!r.ok || data.receipt !== requestId ||
                ['delivered', 'queued'].indexOf(data.delivery) === -1)) {
              throw new Error('Unconfirmed submission');
            }
            return data;
          });
        })
        .then(function (data) {
          if (data.ok) {
            if (data.delivery === 'queued') {
              showStatus(status, 'success', data.message);
              if (goalReceipt !== requestId) { reachGoal(form); goalReceipt = requestId; }
              // Не обещаем доставку в CRM до её подтверждения; остаёмся на
              // странице с номером квитанции. Повторный клик имеет тот же ID.
              return;
            }
            // Успех → уводим на полноценную страницу «Спасибо» (/spasibo/).
            // Телефон хранится только в текущей вкладке, не в URL/логах.
            if (goalReceipt !== requestId) { reachGoal(form); goalReceipt = requestId; }
            var phoneVal = phone ? phone.value.trim() : '';
            var url = (location.pathname.match(/^\/(?:ru|kz|en)(?=\/)/) || [''])[0] + '/spasibo/';
            try { sessionStorage.setItem('ui_lead_confirmed_phone', phoneVal); } catch (e) {}
            // пропуск на «Спасибо» на 15 минут: без него открытая напрямую /spasibo/ — «не найдена» (proxy.ts)
            document.cookie = 'ui_lead_sent=1; Max-Age=900; Path=' + url + '; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
            showStatus(status, 'success', 'Заявка отправлена! Переходим…');
            window.location.assign(url);
            return; // дальше не выполняем — уходим со страницы
          } else {
            showStatus(status, 'error', data.message || 'Не удалось отправить. Позвоните: +7 (775) 853-40-95');
          }
        })
        .catch(function () {
          showStatus(status, 'error', 'Не удалось получить подтверждение отправки. Данные сохранены в форме — попробуйте ещё раз. Позвоните: +7 (775) 853-40-95');
        })
        .finally(function () {
          clearTimeout(timeout);
          submitting = false;
          form.removeAttribute('aria-busy');
          if (submitBtn) {
            submitBtn.disabled = false;
            if (submitBtn.dataset.label) submitBtn.innerHTML = submitBtn.dataset.label;
          }
        });
    });
  });

  function showStatus(el: HTMLElement | null, type: StatusType, msg: string) {
    if (!el) {
      // нет контейнера статуса — fallback на alert при успехе/ошибке
      if (type === 'success' || type === 'error') alert(msg);
      return;
    }
    el.textContent = msg;
    el.className = 'js-form-status form-status form-status--' + type;
    el.hidden = !msg;
    el.style.display = msg ? 'block' : 'none';
    if (type === 'error' && msg && typeof el.focus === 'function') {
      el.setAttribute('tabindex', '-1');
      el.focus();
    }
  }
})();

export {};
