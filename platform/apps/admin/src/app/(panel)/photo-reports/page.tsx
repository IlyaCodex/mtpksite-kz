import type { Metadata } from 'next';
import type { PhotoReportSettings } from '@mtpk/content-model';
import { PageHeader } from '@/components/ui';
import { requireUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { serviceJson } from '@/lib/services';
import { PhotoReportsEditor } from './PhotoReportsEditor';

export const metadata: Metadata = { title: 'Фотоотчёты' };

export default async function PhotoReportsPage() {
  const user = await requireUser('content');
  const settings = await serviceJson<PhotoReportSettings>('content', 'photo-reports', { user });
  return (
    <>
      <PageHeader
        title="Фотоотчёты"
        description="Отгрузки, запуски и сервисные выезды — карточки с фото и видео на странице «Проекты» (блок «Фотоотчёты с объектов»). Первое фото — обложка карточки, на ней месяц и регион. Файлы — в медиатеке, папка img/otchety/<год>/<отчёт>/. После сохранения страница обновится в течение минуты."
      />
      <PhotoReportsEditor initial={settings} siteUrl={env().PUBLIC_SITE_URL} />
    </>
  );
}
