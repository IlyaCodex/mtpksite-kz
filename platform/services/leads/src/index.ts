/**
 * Сервис заявок — замена /api/send.php. Принимает формы сайта (forms.js),
 * проверяет их по правилам send.php, сохраняет в PostgreSQL и ставит доставку
 * (письмо + лид Битрикс24) в очередь BullMQ. Заявка не теряется, даже если
 * почта или CRM недоступны: доставка повторится автоматически.
 *
 * Ответ — контракт forms.js: { ok, message, receipt, delivery }.
 *   delivery = delivered → forms.js ведёт на /spasibo/;
 *   delivery = queued    → «принято», доставка догонит.
 */
import multipart from '@fastify/multipart';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { createLogger, createRedis, createS3, putObject, startService, type LeadResponse } from '@mtpk/shared';
import { createDb, type Lead } from '@mtpk/db';
import { ALLOWED_HOSTS, B24_WEBHOOK, env } from './env.ts';
import { clean, isTooFast, originAllowed, pageUrlFrom, parseLead, validateLead, type Fields } from './fields.ts';
import { ATTACH_MAX_BYTES, checkAttachment } from './attachment.ts';
import { createQueue, type DeliveryResult } from './queue.ts';
import { adminRoutes } from './admin.ts';

const log = createLogger('leads');
const { db, close } = createDb(env.DATABASE_URL, { max: 5, appName: 'leads' });
const redis = createRedis(env.REDIS_URL);
const s3 = createS3(env);
const { queue, events } = createQueue(env.REDIS_URL);

const RATE_MAX = 5;
const RATE_WINDOW_S = 60;
const OK_MESSAGE = 'Заявка отправлена! Мы свяжемся с вами в рабочее время.';

function respond(reply: FastifyReply, code: number, body: LeadResponse) {
  return reply.code(code).type('application/json; charset=utf-8').send(body);
}

/** IP клиента: за своим шлюзом — из X-Real-IP, иначе адрес соединения (XFF клиента не доверяем). */
function clientIp(req: FastifyRequest): string {
  if (env.LEADS_TRUST_PROXY) {
    const real = req.headers['x-real-ip'];
    if (typeof real === 'string' && real) return real.trim();
  }
  return req.socket.remoteAddress ?? '0.0.0.0';
}

/** Скользящее окно 5 заявок в минуту на IP (Redis ZSET вместо файлов в /tmp). */
async function rateLimited(ip: string): Promise<boolean> {
  const key = `leads:rl:${ip}`;
  const now = Date.now();
  try {
    const res = await redis
      .multi()
      .zremrangebyscore(key, 0, now - RATE_WINDOW_S * 1000)
      .zcard(key)
      .zadd(key, now, `${now}-${Math.random()}`)
      .expire(key, RATE_WINDOW_S)
      .exec();
    const count = Number(res?.[1]?.[1] ?? 0);
    return count >= RATE_MAX;
  } catch (err) {
    log.warn({ err }, 'rate-limit недоступен (Redis) — пропускаем');
    return false;
  }
}

function cookiesOf(req: FastifyRequest): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    try {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* битая cookie */
    }
  }
  return out;
}

interface Upload {
  filename: string;
  data: Buffer;
  truncated: boolean;
}

/** Поля формы: multipart (FormData из forms.js, с файлом) или urlencoded. */
async function readForm(req: FastifyRequest): Promise<{ fields: Fields; file: Upload | null }> {
  const fields: Fields = {};
  let file: Upload | null = null;
  if (req.isMultipart()) {
    for await (const part of req.parts()) {
      if (part.type === 'file') {
        const data = await part.toBuffer().catch(() => Buffer.alloc(0));
        if (part.fieldname === 'file' && part.filename) {
          file = { filename: part.filename, data, truncated: part.file.truncated };
        }
      } else if (typeof part.value === 'string' && fields[part.fieldname] === undefined) {
        fields[part.fieldname] = part.value;
      }
    }
  } else if (req.body && typeof req.body === 'object') {
    for (const [k, v] of Object.entries(req.body as Record<string, unknown>)) fields[k] = typeof v === 'string' ? v : undefined;
  }
  return { fields, file };
}

async function reject(reason: string, f: Fields, req: FastifyRequest, ip: string) {
  log.info({ reason }, 'заявка отброшена антиспамом');
  await db.leadReject
    .create({
      data: {
        reason,
        phone: clean(f.phone, 32),
        name: clean(f.name, 120),
        source: clean(f.source, 300),
        ip,
        userAgent: clean(req.headers['user-agent'], 200),
      },
    })
    .catch((err) => log.error({ err }, 'не записан отказ'));
}

/** Ждём доставку недолго: успели — «доставлено», нет — «в очереди» (заявка уже в БД). */
async function waitDelivery(jobId: string): Promise<'delivered' | 'queued'> {
  if (env.LEADS_SYNC_WAIT_MS <= 0) return 'queued';
  const job = await queue.getJob(jobId);
  if (!job) return 'queued';
  try {
    const result = (await job.waitUntilFinished(events, env.LEADS_SYNC_WAIT_MS)) as DeliveryResult;
    return result.mail === 'sent' || result.b24 === 'sent' ? 'delivered' : 'queued';
  } catch {
    return 'queued';
  }
}

function deliveryOf(lead: Lead): 'delivered' | 'queued' {
  return lead.mailStatus === 'sent' || lead.b24Status === 'sent' ? 'delivered' : 'queued';
}

async function handle(req: FastifyRequest, reply: FastifyReply) {
  if (!originAllowed(req.headers.origin, req.headers.referer, ALLOWED_HOSTS)) {
    return respond(reply, 403, { ok: false, message: 'Недопустимый источник запроса' });
  }
  const ip = clientIp(req);
  const { fields: f, file } = await readForm(req);
  const requestId = clean(f.request_id, 64);
  const silentOk = { ok: true, message: 'Заявка принята', receipt: requestId || undefined, delivery: 'queued' as const };

  // Honeypot: поле скрыто от человека — заполнил бот. Тихо отбрасываем.
  if (clean(f.hp_token)) {
    await reject('honeypot', f, req, ip);
    return respond(reply, 200, silentOk);
  }
  const tooFast = isTooFast(f.form_ts);
  if (tooFast !== null) {
    await reject(`timecheck:${tooFast}ms`, f, req, ip);
    return respond(reply, 200, silentOk);
  }
  if (await rateLimited(ip)) {
    return respond(reply, 429, { ok: false, message: 'Слишком много заявок. Попробуйте через минуту.' });
  }

  const lead = parseLead(f, cookiesOf(req));
  const invalid = validateLead(lead);
  if (invalid) return respond(reply, 422, { ok: false, message: invalid });

  // Повторная отправка той же заявки (forms.js повторяет с тем же request_id) — без дубля.
  if (lead.requestId) {
    const prev = await db.lead.findUnique({ where: { requestId: lead.requestId } });
    if (prev) return respond(reply, 200, { ok: true, message: OK_MESSAGE, receipt: lead.requestId, delivery: deliveryOf(prev) });
  }

  let attachment: { name: string; data: Buffer } | null = null;
  let attachmentNote: string | null = null;
  if (file) {
    const check = checkAttachment(file.filename, file.data, file.truncated);
    if (check.ok) attachment = { name: check.name, data: file.data };
    else attachmentNote = check.note;
  }

  // параллельный дубль с тем же request_id не вставляется (skipDuplicates) и не возвращается
  const [row] = await db.lead.createManyAndReturn({
    skipDuplicates: true,
    data: {
      requestId: lead.requestId || null,
      source: lead.source || null,
      pageUrl: pageUrlFrom(req.headers.referer, ALLOWED_HOSTS) || null,
      phone: lead.phone,
      name: lead.name || null,
      email: lead.email || null,
      task: lead.task || null,
      fields: lead.fields,
      utm: lead.utm,
      consent: lead.consent || null,
      b24Trace: lead.b24Trace || null,
      b24TraceValid: lead.b24TraceValid,
      ymUid: lead.ymUid || null,
      roistatVisit: lead.roistatVisit || null,
      ip,
      userAgent: clean(req.headers['user-agent'], 200) || null,
      attachmentName: attachment?.name ?? null,
      attachmentNote,
      mailStatus: 'pending',
      b24Status: B24_WEBHOOK ? 'pending' : 'skipped',
    },
  });
  if (!row) {
    // параллельный дубль с тем же request_id
    return respond(reply, 200, { ok: true, message: OK_MESSAGE, receipt: lead.requestId, delivery: 'queued' });
  }
  log.info({ leadId: row.id, source: row.source }, 'заявка сохранена');

  if (attachment) {
    // Приватный оригинал хранится до доставки письма и файла в CRM (либо намеренного пропуска CRM).
    const key = `leads/kz/${row.id}/${attachment.name}`; // бакет общий с основным сайтом
    try {
      await putObject(s3, env.S3_BUCKET_PRIVATE, key, attachment.data, 'application/octet-stream');
      await db.lead.update({ where: { id: row.id }, data: { attachmentKey: key } });
    } catch (err) {
      log.error({ err, leadId: row.id }, 'вложение не сохранено');
      await db.lead.update({
        where: { id: row.id },
        data: { attachmentName: null, attachmentNote: `Файл «${attachment.name}» не сохранился на сервере` },
      });
    }
  }

  const job = await queue.add('deliver', { leadId: row.id }, { jobId: `lead-${row.id}` });
  const delivery = await waitDelivery(job.id!);
  return respond(reply, 200, { ok: true, message: OK_MESSAGE, receipt: lead.requestId || String(row.id), delivery });
}

await startService({
  name: 'leads',
  description: 'Приём заявок с сайта (/api/send.php, /api/leads) и доставка в почту и Битрикс24 через очередь. Служебное /admin/v1 — список заявок, повторная доставка, статистика.',
  port: env.LEADS_PORT,
  logger: log,
  bodyLimit: ATTACH_MAX_BYTES + 2 * 1024 * 1024,
  async setup(app) {
    await app.register(multipart, {
      limits: { fileSize: ATTACH_MAX_BYTES, files: 1, fields: 60, fieldSize: 64 * 1024 },
      // файл больше лимита не валит запрос: помечается truncated и отклоняется с пометкой
      throwFileSizeLimit: false,
    });
    app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) => {
      done(null, Object.fromEntries(new URLSearchParams(body as string)));
    });
    // Старый адрес формы и новый — один обработчик
    const form = { schema: { tags: ['Заявки'], summary: 'Заявка с формы сайта (multipart/form-data или urlencoded)' } };
    app.post('/api/send.php', { schema: { hide: true } }, handle);
    app.post('/api/leads', form, handle);
    app.get('/api/send.php', { schema: { hide: true } }, (_req, reply) => respond(reply, 405, { ok: false, message: 'Метод не поддерживается' }));
    await app.register(adminRoutes, { db, queue, adminToken: env.ADMIN_TOKEN });
  },
  async readiness() {
    await db.$queryRaw`select 1`;
    await redis.ping();
  },
  async onClose() {
    await events.close();
    await queue.close();
    redis.disconnect();
    await close();
  },
});
