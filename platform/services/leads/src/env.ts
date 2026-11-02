import { z } from 'zod';
import { envParts, readEnv } from '@mtpk/shared';

export const env = readEnv(
  z.object({
    ...envParts.base,
    ...envParts.db,
    ...envParts.redis,
    ...envParts.s3,
    ...envParts.admin,
    LEADS_PORT: z.coerce.number().default(4102),
    /** Хосты, с которых принимаются формы (Origin/Referer) */
    LEADS_ALLOWED_HOSTS: z.string().default('uralinduktor.kz,www.uralinduktor.kz'),
    /** За своим шлюзом: брать IP клиента из X-Real-IP/X-Forwarded-For */
    LEADS_TRUST_PROXY: envParts.bool,
    /** Сколько ждать доставки в CRM/почту прежде чем ответить «принято в очередь», мс */
    LEADS_SYNC_WAIT_MS: z.coerce.number().default(8000),
    MAIL_TRANSPORT: z.enum(['smtp', 'log']).default('log'),
    SMTP_HOST: z.string().default(''),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_SECURE: z.enum(['ssl', 'tls']).default('ssl'),
    SMTP_USER: z.string().default(''),
    SMTP_PASS: z.string().default(''),
    MAIL_TO: z.string().default(''),
    MAIL_FROM: z.string().default(''),
    B24_WEBHOOK: z.string().default(''),
    B24_YM_UID_FIELD: z.string().default('UF_CRM_YA_CID'),
    /** Множественное файловое поле CRM; проверяется через API только для заявок с файлом. */
    B24_FILE_FIELD: z.string().default('UF_CRM_SITE_FILES'),
    /** локально (не production) проверить настоящую доставку: письмо и лид в Битрикс24 */
    LEADS_LOCAL_DELIVERY: envParts.bool,
  }),
);

export const ALLOWED_HOSTS = env.LEADS_ALLOWED_HOSTS.split(',').map((h) => h.trim()).filter(Boolean);

/**
 * Заявки по-настоящему (письмо по SMTP, лид в Битрикс24) уходят только на сервере — там
 * docker-compose задаёт NODE_ENV=production. Локально — только база и лог, даже если в .env
 * боевые SMTP и вебхук: проверки не засоряют почту и CRM. Проверить доставку локально —
 * LEADS_LOCAL_DELIVERY=true.
 */
const live = env.NODE_ENV === 'production' || env.LEADS_LOCAL_DELIVERY;
export const MAIL_TRANSPORT = live ? env.MAIL_TRANSPORT : 'log';
export const B24_WEBHOOK = live ? env.B24_WEBHOOK : '';
