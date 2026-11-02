/**
 * Воркер доставки заявок: письмо менеджеру (SMTP) и лид в Битрикс24.
 * Каналы независимы: упал один — второй всё равно отправляется, а BullMQ
 * повторяет задание (8 попыток с нарастающей паузой) только для недоставленного.
 */
import { Worker, type Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { createLogger, createS3, deleteObject, getObject } from '@mtpk/shared';
import { createDb, type Lead, type Prisma } from '@mtpk/db';
import { B24_WEBHOOK, env, MAIL_TRANSPORT } from './env.ts';
import { bitrixLeadFields, emailBody, MAIL_SUBJECT } from './messages.ts';
import { ATTACH_MAX_BYTES, checkAttachment } from './attachment.ts';
import { deliverBitrixAttachment, readAttachmentBody, type BitrixReply, type CrmAttachment } from './crm-attachment.ts';
import { createAttachmentDeliveryGate, deliverChannels } from './delivery-attempt.ts';
import { bullConnection, QUEUE, type DeliveryJob, type DeliveryResult } from './queue.ts';

const log = createLogger('leads-worker');
const { db, close } = createDb(env.DATABASE_URL, { max: 3, appName: 'leads-worker' });
const s3 = createS3(env);
// At most one attachment may occupy Buffer/base64/JSON memory in this 256 MiB worker.
const withAttachmentDelivery = createAttachmentDeliveryGate();

const smtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.MAIL_TO);
const transport =
  MAIL_TRANSPORT === 'smtp' && smtpConfigured
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT ?? (env.SMTP_SECURE === 'tls' ? 587 : 465),
        secure: env.SMTP_SECURE === 'ssl',
        requireTLS: env.SMTP_SECURE === 'tls',
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        // у почтового сервера несколько адресов: недоступный — к следующему через 10 с, а не через 2 мин
        connectionTimeout: 10_000,
        greetingTimeout: 15_000,
        // проверка сертификата включена по умолчанию — не отключать
      })
    : nodemailer.createTransport({ jsonTransport: true });

async function sendMail(lead: Lead, loadAttachment: () => Promise<CrmAttachment>): Promise<void> {
  const attachments: { filename: string; content: Buffer }[] = [];
  if (lead.attachmentKey || lead.attachmentName) {
    const file = await loadAttachment();
    attachments.push({ filename: file.name, content: file.data });
  }
  const info = await transport.sendMail({
    from: { name: 'Сайт Уралиндуктор', address: env.MAIL_FROM || env.SMTP_USER || 'site@uralinduktor.kz' },
    to: env.MAIL_TO || 'stasgross.ru@gmail.com',
    replyTo: lead.email || undefined,
    subject: MAIL_SUBJECT,
    text: emailBody(lead),
    attachments,
  });
  if (MAIL_TRANSPORT === 'log' || !smtpConfigured) {
    log.info({ leadId: lead.id, preview: JSON.parse(String(info.message)).text?.slice(0, 400) }, 'письмо (режим log — не отправлялось)');
  }
}

/** JSON avoids URL-encoding another large copy of a base64 attachment. */
async function b24call(method: string, params: Record<string, unknown>, timeoutMs = 10_000): Promise<BitrixReply> {
  const base = B24_WEBHOOK.replace(/\/?$/, '/');
  let res: Response;
  try {
    res = await fetch(`${base}${method}.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new Error(`${method}: request failed or timed out`);
  }
  const http = res.status;
  if (http !== 200) return { result: null, http };
  const json = (await res.json().catch(() => ({}))) as { result?: unknown; error?: unknown };
  return { result: json.result ?? null, http, ...(json.error ? { error: 'API_ERROR' } : {}) };
}

async function deliver(job: Job<DeliveryJob, DeliveryResult>): Promise<DeliveryResult> {
  const lead = await db.lead.findUnique({ where: { id: job.data.leadId } });
  if (!lead) throw new Error(`заявка ${job.data.leadId} не найдена`);
  if (!lead.attachmentKey && !lead.attachmentName) return deliverLead(job, lead);
  return withAttachmentDelivery(async () => {
    // A queued resend may have waited while the earlier job persisted channel acknowledgements.
    const current = await db.lead.findUnique({ where: { id: lead.id } });
    if (!current) throw new Error(`заявка ${lead.id} не найдена`);
    return deliverLead(job, current);
  });
}

async function deliverLead(job: Job<DeliveryJob, DeliveryResult>, lead: Lead): Promise<DeliveryResult> {
  // Read once per attempt, with a limit even if S3 reports a wrong/missing length.
  let attachment: Promise<CrmAttachment> | undefined;
  const loadAttachment = (): Promise<CrmAttachment> => attachment ??= (async () => {
    if (!lead.attachmentKey || !lead.attachmentName) throw new Error('Attachment source is unavailable; restore it before retry');
    const obj = await getObject(s3, env.S3_BUCKET_PRIVATE, lead.attachmentKey, `bytes=0-${ATTACH_MAX_BYTES}`);
    const data = await readAttachmentBody(obj.Body, obj.ContentLength);
    const checked = checkAttachment(lead.attachmentName, data, false);
    if (!checked.ok) throw new Error('Stored attachment failed file validation');
    return { name: checked.name, data };
  })();
  const hasAttachment = Boolean(lead.attachmentKey || lead.attachmentName);
  const lastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
  const { mail, b24, errors } = await deliverChannels(lead, { bitrixEnabled: Boolean(B24_WEBHOOK), lastAttempt }, {
    sendMail: () => sendMail(lead, loadAttachment),
    sendBitrix: async () => {
      const fields = bitrixLeadFields(lead, env.B24_YM_UID_FIELD);
      const created = hasAttachment
        ? await deliverBitrixAttachment({
            siteLeadId: lead.id,
            existingLeadId: lead.b24LeadId,
            fields,
            fileField: env.B24_FILE_FIELD,
            loadAttachment,
            call: (method, params) => b24call(method, params, 60_000),
            persistLeadId: async id => { await db.lead.update({ where: { id: lead.id }, data: { b24LeadId: id } }); },
          })
        : await (async () => {
            // Requests without files retain the original single-add path.
            const { result, http } = await b24call('crm.lead.add', { fields });
            if (!result) throw new Error(`crm.lead.add: HTTP ${http}`);
            return { leadId: Number(result), http };
          })();
      const leadId = created.leadId;
      const patch: Record<string, unknown> = { b24LeadId: leadId, b24Http: created.http };
      // Existing attribution semantics: trace failure never cancels a delivered lead/file.
      if (lead.b24Trace) {
        if (lead.b24TraceValid) {
          const trace = await b24call('crm.tracking.trace.add', { TRACE: lead.b24Trace, ENTITIES: [{ TYPE: 'LEAD', ID: leadId }] }).catch(
            () => ({ result: null, http: 0 }),
          );
          Object.assign(patch, trace.result ? { b24TraceStatus: 'sent', b24TraceId: Number(trace.result) } : { b24TraceStatus: `failed:${trace.http}` });
        } else {
          patch.b24TraceStatus = 'invalid';
        }
      } else {
        patch.b24TraceStatus = 'skip';
      }
      return patch;
    },
    persist: async patch => { await db.lead.update({ where: { id: lead.id }, data: patch as Prisma.LeadUpdateInput }); },
    deleteAttachment: key => deleteObject(s3, env.S3_BUCKET_PRIVATE, key),
    onCleanupError: err => log.warn({ leadId: lead.id, error: err instanceof Error ? err.name : 'Error' }, 'вложение доставлено, очистка S3 будет повторена позже'),
  });

  log.info({ leadId: lead.id, mail, b24, attempt: job.attemptsMade + 1 }, 'доставка заявки');
  if (errors.length) {
    // Отвечаем API (если ждёт) частичным успехом, но задание повторится
    if (mail === 'sent' || b24 === 'sent') await job.updateProgress({ mail, b24 });
    throw new Error(errors.join('; '));
  }
  return { mail, b24 };
}

const worker = new Worker<DeliveryJob, DeliveryResult>(QUEUE, deliver, {
  connection: bullConnection(env.REDIS_URL),
  concurrency: 4,
});
worker.on('failed', (job, err) => log.warn({ jobId: job?.id, attempts: job?.attemptsMade, err: err.message }, 'попытка доставки не удалась'));
worker.on('error', (err) => log.error({ err }, 'ошибка воркера'));
log.info({ queue: QUEUE, mail: MAIL_TRANSPORT === 'smtp' && smtpConfigured ? 'smtp' : 'log', b24: Boolean(B24_WEBHOOK) }, 'воркер доставки запущен');

const shutdown = async () => {
  await worker.close();
  await close();
  process.exit(0);
};
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
