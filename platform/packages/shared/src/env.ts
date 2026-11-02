import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

let dotEnvLoaded = false;

function findUp(name: string, from: string): string | null {
  let dir = from;
  for (;;) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Подхватывает platform/.env при локальной разработке. Ищет файл вверх от cwd,
 * поэтому работает из любого пакета монорепо. Переменные, уже заданные
 * окружением (Docker, CI), файл не перетирает. В контейнерах .env нет —
 * функция просто ничего не делает.
 */
export function loadDotEnv(): void {
  if (dotEnvLoaded) return;
  dotEnvLoaded = true;
  const file = process.env.MTPK_ENV_FILE ?? findUp('.env', process.cwd());
  if (file && fs.existsSync(file)) process.loadEnvFile(file);
}

/** Разбирает process.env по схеме; при ошибке падает с понятным списком полей. */
export function readEnv<S extends z.ZodType>(schema: S): z.infer<S> {
  loadDotEnv();
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Некорректные переменные окружения:\n${lines.join('\n')}`);
  }
  return parsed.data;
}

const bool = z
  .enum(['true', 'false', '1', '0', 'yes', 'no', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1' || v === 'yes');

/** Наборы полей, из которых сервисы собирают свои схемы окружения. */
export const envParts = {
  base: {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z.string().default('info'),
    SITE_URL: z.string().default('https://uralinduktor.kz'),
  },
  db: {
    DATABASE_URL: z.string().min(1),
  },
  redis: {
    REDIS_URL: z.string().min(1),
  },
  s3: {
    S3_ENDPOINT: z.string().min(1),
    S3_REGION: z.string().default('us-east-1'),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(1),
    S3_FORCE_PATH_STYLE: bool,
    S3_BUCKET_ASSETS: z.string().default('mtpk-assets'),
    S3_BUCKET_PRIVATE: z.string().default('mtpk-private'),
  },
  admin: {
    ADMIN_TOKEN: z.string().min(8),
  },
  bool,
};

export type S3Env = {
  S3_ENDPOINT: string;
  S3_REGION: string;
  S3_ACCESS_KEY: string;
  S3_SECRET_KEY: string;
  S3_FORCE_PATH_STYLE: boolean;
};
