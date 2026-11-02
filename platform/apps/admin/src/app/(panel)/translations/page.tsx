import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { TranslationsManager } from './TranslationsManager';

export const metadata: Metadata = { title: 'Переводы' };

export default async function TranslationsPage() {
  await requireUser('content');
  return (
    <>
      <PageHeader
        title="Переводы"
        description="Содержимое сайта — на русском, казахская и английская версии берут текст из этого словаря: каждая строка переводится один раз и меняется сразу на всех страницах. Новый или изменённый текст остаётся русским, пока здесь нет перевода; проверить страницу — поле «Что не переведено». Страницы подхватывают правку в течение часа или сразу по кнопке."
      />
      <TranslationsManager />
    </>
  );
}
