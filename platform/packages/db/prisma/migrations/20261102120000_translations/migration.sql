-- Словарь переводов сайта на языках ru, kz, en: русская строка → перевод.
CREATE TABLE "content"."translations" (
    "locale" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'live',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "translations_pkey" PRIMARY KEY ("locale","hash")
);
