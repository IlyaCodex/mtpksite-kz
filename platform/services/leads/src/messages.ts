import type { Lead } from '@mtpk/db';
import { extraLines } from './fields.ts';

/**
 * Тексты заявки — письмо менеджеру и поля лида Битрикс24. Формат и порядок
 * строк — как в send.php: менеджеры и автоматизации CRM привыкли к нему.
 */

export const MAIL_SUBJECT = 'Новая заявка с сайта uralinduktor.kz';

function fmtTime(d: Date): string {
  // Время сервера в Екатеринбурге (UTC+5) — как date('Y-m-d H:i:s') на VPS
  const local = new Date(d.getTime() + 5 * 3600_000);
  return local.toISOString().replace('T', ' ').slice(0, 19);
}

function traceLine(lead: Lead): string | null {
  if (!lead.b24Trace) return null;
  return `B24 trace: ${lead.b24TraceValid ? 'получен' : 'некорректный'} (${Buffer.byteLength(lead.b24Trace)} байт)`;
}

export function emailBody(lead: Lead): string {
  const utm = (lead.utm ?? {}) as Record<string, string>;
  const lines = ['Новая заявка с сайта uralinduktor.kz', '────────────────────────────', `Телефон: ${lead.phone}`];
  if (lead.name) lines.push(`Имя: ${lead.name}`);
  if (lead.email) lines.push(`Email: ${lead.email}`);
  if (lead.task) lines.push(`Задача: ${lead.task}`);
  lines.push(...extraLines((lead.fields ?? {}) as Record<string, string>));
  if (lead.pageUrl) lines.push(`Страница: ${lead.pageUrl}`);
  if (lead.source) lines.push(`Источник: ${lead.source}`);
  const trace = traceLine(lead);
  if (trace) lines.push(trace);
  if (lead.ymUid) lines.push(`Client ID Метрики: ${lead.ymUid}`);
  for (const [k, v] of Object.entries(utm)) lines.push(`${k}: ${v}`);
  if (lead.consent) lines.push(`Согласие ПД: ${lead.consent}`);
  if (lead.attachmentName) lines.push(`КП клиента: во вложении (${lead.attachmentName})`);
  if (lead.attachmentNote) lines.push(`⚠ ${lead.attachmentNote} — запросите КП у клиента`);
  lines.push('────────────────────────────', `IP: ${lead.ip ?? ''}`, `Время: ${fmtTime(lead.createdAt)}`);
  lines.push(`Заявка №${lead.id} в базе сайта`);
  return lines.join('\n');
}

/**
 * Рекламный кабинет: кампании uibusiness имеют префикс AImarketing_,
 * остальные размеченные кампании Яндекс Директа — кабинет УралИндуктор3.
 */
export function adAccount(utm: Record<string, string>): string {
  const campaign = utm.utm_campaign ?? '';
  const source = (utm.utm_source ?? '').toLowerCase();
  if (/^AImarketing_/i.test(campaign)) return 'uibusiness';
  if (campaign && source === 'yandex') return 'УралИндуктор3';
  return '';
}

export function bitrixLeadFields(lead: Lead, ymUidField: string): Record<string, unknown> {
  const utm = (lead.utm ?? {}) as Record<string, string>;
  const account = adAccount(utm);
  const title = `Заявка с сайта${lead.name ? ` — ${lead.name}` : ''}${lead.phone ? ` · ${lead.phone}` : ''}`;

  let comments = `Телефон: ${lead.phone}`;
  if (lead.name) comments += `\nИмя: ${lead.name}`;
  if (lead.email) comments += `\nEmail: ${lead.email}`;
  if (lead.task) comments += `\n\nЗадача: ${lead.task}`;
  const extra = extraLines((lead.fields ?? {}) as Record<string, string>);
  if (extra.length) comments += `\n${extra.join('\n')}`;
  if (lead.attachmentName) comments += `\nКП клиента: ${lead.attachmentName} (файл заявки)`;
  if (lead.attachmentNote) comments += `\n⚠ ${lead.attachmentNote} — запросите КП у клиента`;
  if (lead.pageUrl) comments += `\n\nСтраница: ${lead.pageUrl}`;
  if (lead.source) comments += `${lead.pageUrl ? '\n' : '\n\n'}Источник: ${lead.source}`;
  const trace = traceLine(lead);
  if (trace) comments += `\n${trace}`;
  if (lead.ymUid) comments += `\nClient ID Метрики: ${lead.ymUid}`;
  if (account) comments += `\nРекламный кабинет: ${account}`;
  if (Object.keys(utm).length) {
    comments += '\n\n— Метки —';
    for (const [k, v] of Object.entries(utm)) comments += `\n${k}: ${v}`;
  }
  if (lead.consent) comments += `\nСогласие ПД: ${lead.consent}`;

  const fields: Record<string, unknown> = {
    TITLE: title,
    NAME: lead.name || 'Клиент с сайта',
    STATUS_ID: 'NEW',
    OPENED: 'Y',
    SOURCE_ID: 'WEB',
    COMMENTS: comments,
  };
  if (account) fields.SOURCE_DESCRIPTION = `Яндекс Директ — ${account}`;
  if (lead.phone) fields.PHONE = [{ VALUE: lead.phone, VALUE_TYPE: 'WORK' }];
  if (lead.email) fields.EMAIL = [{ VALUE: lead.email, VALUE_TYPE: 'WORK' }];
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    if (utm[k]) fields[k.toUpperCase()] = utm[k];
  }
  if (lead.ymUid && ymUidField) fields[ymUidField] = lead.ymUid;
  return fields;
}

/** http_build_query из PHP: вложенные объекты/массивы → fields[PHONE][0][VALUE]=… */
export function phpBuildQuery(data: Record<string, unknown>): string {
  const parts: string[] = [];
  const walk = (value: unknown, key: string) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${key}[${i}]`));
    else if (typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, `${key}[${k}]`);
    else parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  };
  for (const [k, v] of Object.entries(data)) walk(v, k);
  return parts.join('&');
}
