# Структура сайта — карта страниц

> **С 07.10.2026 сайт — платформа `platform/`** (Next.js, база, админка), папка `astro/` удалена. Пути вида
> `astro/src/raw-pages/…` и `astro/public/…` в тексте ниже — исторические: страницы теперь в базе (админка),
> картинки — в медиатеке (S3), адреса `/img/…` те же. Актуальное устройство — [`CLAUDE.md`](CLAUDE.md).

> **Источник правды** по структуре сайта. Документ ведётся постоянно.
> При создании любой новой страницы — обязательно вносить сюда её URL,
> назначение, тип и привязку к меню.
>
> Заменяет старый `SITEMAP.md` (тот файл оставлен как архив).

---

## 📐 Терминология и типы страниц (источник правды)

**Иерархия каталога:**

```
L0  Главная                    /
L1  Корень каталога            /products/
L2  РАЗДЕЛ (12 шт.)            /products/<раздел>/
L3  КАТЕГОРИЯ (36 шт.)         /products/<раздел>/<категория>/
L4  ТОВАР (296 шт.)            /products/<раздел>/<категория>/<товар>/
                                /products/<раздел>/<товар>/          ← если у раздела нет L3
```

**Используется ВЕЗДЕ** (документация, обсуждения, коммит-месседжи).

> ⚠️ С 03.06.2026 заменена прошлая терминология «категория → подкатегория → товар». В коде CSS-классы (`cat-hero`, `cat-section`) остались как есть — это технические имена, не путать с бизнес-сущностями.

**Раздел каталога делится на 2 типа шаблона:**

- **Продуктовые разделы (10 шт., шаблон T03a):** induktsionnye-plavilnye-pechi, induktsionnye-nagrevateli, drobemetnoe-oborudovanie, sistemy-ohlazhdeniya, termicheskie-pechi, zapchasti, vakuumnoe-oborudovanie-dlya-termoobrabotki, stalerozlivochnye-kovshi, sterzhnevye-mashiny, termoobrabotka-plavka-alyuminiya.
- **Технологические разделы (4 шт., шаблон T03b):** oborudovanie-dlya-peschano-glinistyh-smesej-pgs, linii-dlya-holodnotverdeyushhih-smesej-hts, oborudovanie-lgm, oborudovanie-lvm.
- **peskostruynoe-oborudovanie** (2026-08-19): новый раздел, хаб по образцу ПГС (богатый информативный) + 13 плоских товаров (шаблон tovar-b/phero), гарантия 12 мес. Товары: prohodnaya-s-gusenichnym-transporterom, prohodnaya-s-kombinirovannoy-gruppoy-sopel, prohodnaya-s-lentochnym-transporterom, prohodnaya-napornaya-dlya-dlinnomernyh-izdeliy, s-v-obraznymi-remnyami, napornaya-s-indeksnym-povorotnym-stolom, napornaya-s-kachayushchimisya-soplami-povorotnyj-stol, telezhechnaya-napornaya-s-povorotnym-stolom, telezhechnaya-napornaya-s-ruchnym-soplom, dlya-obrabotki-rezhushchego-instrumenta, dlya-ochistki-press-form-shin, ruchnaya-kabina-900h900, ruchnaya-telezhechnaya-kabina-1200h1200. Источник контента: PDF (в тексте «дробеструйн» заменено на «пескоструйн»).

**Полный реестр типов страниц и их шаблонов** — см. [`docs/page-types/README.md`](docs/page-types/README.md). Под каждый тип — отдельный файл-шаблон `T01-...md` ... `T12-...md`.

---

## Легенда статусов

- ✅ **Готово** — страница в проде, доступна по URL.
- 🟡 **В разработке** — прототип в работе, ещё не в проде.
- ⬜ **План** — известна структура, но страница не начата.

---

## 🔗 URL-конвенция — pretty URLs, БЕЗ `.html`

**Все URL в этом дереве — без расширения и с trailing slash.** Это критично для:
- Совместимости с боевым `uralinduktor.ru` (там URLs тоже без `.html`)
- 301-редиректов при миграции
- SEO (один канонический URL на страницу)

> 🔁 **Глобальная карта 301 старый WP → новый сайт (2026-06-18, на проде):** все 465
> легаси-URL старого сайта редиректятся на новые (или на «/», где сопоставление
> невозможно). Источник правды — [`server/redirects-legacy.map`](server/redirects-legacy.map)
> + [`docs/redirects-migration.md`](docs/redirects-migration.md); на проде nginx
> `map $uri $legacy_redirect`. При переименовании/удалении страниц проверять, не
> ломает ли это цель редиректа (sweep — в migration-доке).

### Правила

| ✅ Правильно | ❌ Неправильно |
|---|---|
| `/proekty/` | `/projects.html`, `/proekty.html` |
| `/products/oborudovanie-lvm/` | `/products/oborudovanie-lvm.html` |
| `/o-kompanii/` | `/o-company.html`, `/about.html` |
| `/uslugi/pod-kluch/` | `/services/turnkey.html` |

### Как это работает на сервере

- На диске каждая страница лежит как `<URL-слаг>/index.html`:
  - `/proekty/` → `/var/www/uralinduktor/public/proekty/index.html`
  - `/products/oborudovanie-lvm/` → `/var/www/.../products/oborudovanie-lvm/index.html`
- nginx разрешает trailing-slash URL → отдаёт `index.html` автоматически.
- Имя файла **в прототипе** (`design/prototypes/category-lvm.html`,
  `projects.html` и т.п.) — это просто рабочее имя для разработки,
  оно НЕ становится URL.

### Что писать в HTML-ссылках

- Только pretty URLs: `href="/products/"`, `href="/proekty/"`, `href="/o-kompanii/"`
- **Никаких** `href="catalog.html"`, `href="projects.html"`, `href="about.html"` —
  это сразу ломает SEO и контракт с боевым сайтом.
- Якоря (`#leadgen`, `#contacts`) — нормально, это не URL.

> ⚠️ Эта конвенция зафиксирована в **CLAUDE.md правило #2** (обязательное к
> чтению в начале каждой сессии). Любая правка меню/футера/навигации
> идёт через `design/prototypes/_partials/` — там тоже только pretty URLs.

---

## Дерево URL

> **Метки типа-шаблона (`Txx`)** проставлены в начале описания каждой строки.
> Реестр типов и счётчики — [`docs/page-types/README.md`](docs/page-types/README.md).
> Кратко: хаб раздела — **T03a** (продуктовый) / **T03b** (технологический);
> категория (L3) — **T04**; товар/позиция (L4) — **T05**; остальные — по реестру.

```
/                                                       ✅ T01 · Главная
│
├── /products/                                          ⬜ T02 · Хаб «Каталог оборудования»
│   │
│   │   ─── Продуктовые разделы: хаб T03a → категории T04 → товары T05 ───
│   ├── /products/induktsionnye-plavilnye-pechi/        ✅ T03a · ХАБ «Индукционные плавильные печи» (4 тизера: 3 по типу металла + транзисторные, грид 2×2)
│   │   ├── po-stali/                                    ✅ T04 · Подраздел «Для стали и чугуна» (20 моделей, фильтр масса+мощность)
│   │   │   └── 20 карточек УИ-…                         ✅ T05 · товары перенесены сюда (301 со старых плоских URL). УИ-1Т-700 удалён 2026-06-30 (→301 на po-stali)
│   │   ├── po-medi/                                     ✅ T04 · Подраздел «Для меди, латуни и бронзы» (12 моделей, фильтр масса+мощность)
│   │   │   └── 12 карточек УИ-…м                        ✅ T05 · 301 со старых плоских URL
│   │   ├── po-alyuminiyu/                               ✅ T04 · Подраздел «Для алюминия» (11 моделей, фильтр масса+мощность)
│   │   │   └── 11 карточек УИ-…а                        ✅ T05 · 301 со старых плоских URL
│   │   └── tranzistornye/                               ✅ T04 · Подраздел «Транзисторные печи (IGBT)» (14 моделей УИ-…П, фильтр масса+мощность)
│   │       ├── po-stali/                                ✅ T04 · «Транзисторные печи для стали и чугуна» (10 моделей: УИ-8П, УИ-10П, УИ-15П…УИ-160П)
│   │       ├── po-medi/                                 ✅ T04 · «…для меди, медных сплавов и золота» (14 моделей)
│   │       ├── po-alyuminiyu/                           ✅ T04 · «…для алюминия и алюминиевых сплавов» (14 моделей)
│   │       │   # 2026-10-26, пакет «Редакция 8»: разделы по металлу — страницы-подборки (catalogList с paths), не записи
│   │       │   #   каталога; карточки моделей остаются по прежним адресам ui-…p/. На общей странице печей — 8 карточек
│   │       │   #   группами: 3 тиристорные, 3 транзисторные (эти разделы), запчасти и футеровка; хаб — ссылкой под группой.
│   │       └── 14 карточек УИ-1П…УИ-160П                ✅ T05 · ui-1p…ui-160p · фото — реальные снимки со старого сайта (исключение из правила №9, согласовано 2026-06-16)
│   │   # 2026-05-29: раздел разбит на 3 подраздела по металлу (как дробемёты). 44 товара /induktsionnye-plavilnye-pechi/<model>/
│   │   #   перенесены под po-stali|po-medi|po-alyuminiyu/<model>/ + 44 301-редиректа в nginx. Тизеры: card-pech-{stal,med,alyuminiy}.png
│   │   # 2026-06-16: добавлен 4-й подраздел tranzistornye/ (14 моделей с боевого uralinduktor.ru/.../induktsionnye-tranzistornye-pechi/). ЗАДЕПЛОЕНО на прод 2026-06-16.
│   │   #   Тизер card-pech-tranzistor.png (цех-канон из фото УИ-160п). 301-блоки nginx ПРИМЕНЕНЫ (30 location: категория + 14 моделей, слеш/без; смоук: старый WP URL → 301 → 200).
│   │   #   Генераторы: scripts/build-tranzistornye-{models,category}.py. Hero/lead/title/description хаба дополнены упоминанием тиристорных+транзисторных.
│   ├── /products/induktsionnye-nagrevateli/             ✅ T03a · Хаб «Индукционные нагреватели» (5 категорий-тизеров, 45 моделей всего)
│   │   └── /products/induktsionnye-nagrevateli/srednechastotnye/        ✅ T04 · Каталог «Среднечастотные» (5 моделей УИ-АВн → T05)
│   │   └── /products/induktsionnye-nagrevateli/vysokochastotnye/        ✅ T04 · Каталог «Высокочастотные» (11 моделей УИ-АВз / УИ-2-АВЗ → T05)
│   │   └── /products/induktsionnye-nagrevateli/ruchnye/                 ✅ T04 · Каталог «Ручные ВЧ на гибком кабеле» (9 страниц УИ-ЛН → T05: 6 моделей, у 15/25/35 отдельно исполнение «-vo» со встроенным охлаждением)
│   │   └── /products/induktsionnye-nagrevateli/sverhvysokochastotnye/   ✅ T04 · Каталог «Сверхвысокочастотные» (12 моделей УИ-АВ/АВВ → T05)
│   │   └── /products/induktsionnye-nagrevateli/ustanovki-zakalki-valov/ ✅ T04 · Каталог «Установки закалки валов» (5 моделей УИ-СЗ → T05)
│   │       └── товары T05 вложены под своей категорией (ТЗ-2 п.6, 2026-06-07; 9 транзисторных УИ-Н удалены)
│   ├── /products/drobemetnoe-oborudovanie/             ✅ T03a · Хаб «Дробемётное оборудование» (9 категорий-тизеров)
│   │   └── /products/drobemetnoe-oborudovanie/kranovogo-tipa/             ✅ T04 · Каталог «Дробемёты кранового типа» (9 моделей УИД)
│   │       └── /products/drobemetnoe-oborudovanie/kranovogo-tipa/uid-376e/  ✅ T05 · Карточка позиции УИД-376Е
│   │   └── /products/drobemetnoe-oborudovanie/barabannogo-tipa/           ✅ T04 · Каталог «Дробемёты барабанного типа» (10 моделей УИД)
│   │       └── 10 карточек T05 uid-320, uid-322, uid-324, uid-326, uid-3110, uid-3113, uid-3210, uid-3220, uid-15, uid-28
│   │   └── /products/drobemetnoe-oborudovanie/s-vrashchayushchimsya-stolom/  ✅ T04 · Каталог «С вращающимся столом» (4 модели УИД)
│   │       └── 4 карточки T05 uid-3512, uid-3515, uid-3518, uid-3525
│   │   └── /products/drobemetnoe-oborudovanie/dlya-shvellera-i-sorta/         ✅ T04 · Каталог «Для швеллера, двутавра и сорта» (12 моделей УИД для проката)
│   │       └── 12 карточек T05 uid-1500-1000, uid-1500-1200, uid-1700-1200, uid-1900-1000, uid-1900-1200, uid-2300-1200, uid-2300-1400, uid-2500-1000, uid-2500-1200, uid-2500-1400, uid-2800-1200, uid-3800-1700
│   │   └── /products/drobemetnoe-oborudovanie/prokhodnye-podvesnogo-tipa/     ✅ T04 · Каталог «Проходные подвесного типа» (4 модели УИД)
│   │       └── 4 карточки T05 uid-383, uid-384, uid-485, uid-4810
│   │   └── /products/drobemetnoe-oborudovanie/dlya-ochistki-trub/             ✅ T04 · Каталог «Для очистки труб» (5 моделей УИДТ)
│   │       └── 5 карточек T05 uidt-20, uidt-30, uidt-50, uidt-100, uidt-150
│   │   └── /products/drobemetnoe-oborudovanie/s-lentochnym-konveyerom/        ✅ T04 · Каталог «С ленточным сетчатым конвейером» (4 модели УИД)
│   │       └── 4 карточки T05 uid-60, uid-80, uid-100, uid-120
│   │   └── /products/drobemetnoe-oborudovanie/s-vykatnym-stolom/              ✅ T04 · Каталог «С выкатным столом» (4 модели УИД-76)
│   │       └── 4 карточки T05 uid-765, uid-7610, uid-7620, uid-7630
│   │   └── /products/drobemetnoe-oborudovanie/peredvizhnye/                   ✅ T04 · Каталог «Передвижные дробемёты» (3 модели BH)
│   │       └── 3 карточки T05 bh270, bh550, bh850
│   │   └── /products/drobemetnoe-oborudovanie/podbor-drobemeta/            ✅ Подбор установки по изделию, массе и потоку
│   │       └── таблица «что очищаем → тип → модели» на 10 строк, 4 шага подбора, FAQ + FAQPage (29.09.2026)
│   │   └── /products/drobemetnoe-oborudovanie/dlya-ochistki-otlivok/       ✅ Страница по задаче: очистка отливок
│   │   └── /products/drobemetnoe-oborudovanie/dlya-metallokonstruktsiy/    ✅ Страница по задаче: металлоконструкции
│   │   └── /products/drobemetnoe-oborudovanie/dlya-pokovok/                ✅ Страница по задаче: поковки
│   │       📌 Четыре страницы созданы по аудиту ИИ-видимости (Desktop/INFO): связка «задача → масса и
│   │          габарит → тип установки → модель» в одном месте. «Прокат» и «трубы» не дублируются —
│   │          для них уже есть /dlya-shvellera-i-sorta/ и /dlya-ochistki-trub/.
│   📌 Редактура коллеги 30.09.2026 (ЛВМ, ЛГМ, ПГС, ХТС — 73 страницы): тексты, title и description
│       переписаны, пять страниц переименованы, старые адреса закрыты 301-редиректами в nginx:
│       lgm/avtoklav → lgm/press-avtomat · lvm/sistema-podachi-parovogo-voska → …/sistema-podachi-modelnogo-voska
│       lvm/barabannyj-peskostrujnyj-apparat → …/barabannyj-apparat-obsypki-obolochek
│       lvm/ochistka-voska → …/ochistka-voskovyh-modelej · pgs/multikontaktnaya-uif-0806 → …/multikontaktnaya-uism-3d806

│   ├── /products/sistemy-ohlazhdeniya/                 ✅ T03a · Хаб «Системы охлаждения» (2 тизера: градирни + чиллеры)
│   │   ├── /products/sistemy-ohlazhdeniya/gradirni/    ✅ T04 · Каталог «Градирни УИГ» (10 моделей)
│   │   │   └── 10 карточек T05 uig-10t … uig-200t
│   │   └── /products/sistemy-ohlazhdeniya/chillery/    ✅ T04 · Каталог «Чиллеры УИЧ» (25 моделей)
│   │       └── 25 карточек T05 uich-005 … uich-30v
│   ├── /products/stalerozlivochnye-kovshi/             ✅ T03a · Хаб «Сталеразливочные ковши» (5 категорий + 42 товара T05)
│   │   ├── …/stalerazlivochnye-kovshi-dlya-rasplavlennoj-stali/      ✅ T04 · Для расплавленной стали
│   │   ├── …/stalerazlivochnye-kovshi-dlya-rasplavlennogo-chuguna/   ✅ T04 · Для расплавленного чугуна
│   │   ├── …/stalerazlivochnye-kovshi-stopornogo-tipa/               ✅ T04 · Стопорного типа
│   │   ├── …/stalerazlivochnye-kovshi-chajnikovogo-tipa/             ✅ T04 · Чайникового типа
│   │   ├── …/kovshi-dlya-modificirovaniya-chuguna/                  ✅ T04 · Для модифицирования чугуна (пакет V8)
│   │   ├── …/kak-vybrat-litejnyj-kovsh/                          ✅ T02 · Как выбрать ковш (пакет V8)
│   │   ├── …/kovshi-s-kryshkoj-i-specialnye-ispolneniya/         ✅ T02 · С крышкой и специсполнения
│   │   ├── …/komplektuyushchie-litejnyh-kovshej/                 ✅ T02 · Комплектующие и запчасти
│   │   ├── …/oprosnyj-list/                                      ✅ T02 · Опросный лист на ковш
│   │   └── 62 карточки T05 УИК-… вложены под своими 5 категориями
│   ├── /products/stendy-sushki-i-nagreva-kovshej/    ✅ T03a · Хаб «Стенды сушки и нагрева ковшей» (пакет V8, 25.09.2026)
│   │   ├── …/gazovye/                                ✅ T04 · Газовые стенды (8 исполнений)
│   │   └── …/elektricheskie/                         ✅ T04 · Электрические стенды (3 исполнения)
│   │       — дизельный стенд 15 т не публикуется: исполнение по запросу (решение Евгения 25.09)
│   │   └── …/oprosnyj-list/                             ✅ T02 · Опросный лист на стенд
│   │       — прежняя страница …/stalerozlivochnye-kovshi/stend-dlya-sushki-i-nagreva-litejnogo-kovsha/ → 301 на хаб
│   │   📷 Картинки: `astro/public/img/card-kovsh-{slug-короткий}.jpg` × 5
│   │       — перерисованы через **fal-ai/gpt-image-1/edit-image** (GPT Image 2, quality=high)
│   │       с реальных фото клиента из `ФОТО/Сталеразливочные ковши/Галлерея с фото/` как референсов:
│   │       конструкция (рёбра жёсткости, траверсы, стопорные/тилт-механизмы, красный маховик) 1-в-1,
│   │       стиль — антрацит/teal-green на чистом белом студийном фоне, без логотипов.
│   │       Hero: `kovshi-hero.jpg` — цех с тремя ковшами через nano-banana 16:9.
│   │   🍰 В мегаменю: пункт «Лабораторное оборудование» заменён на «Сталеразливочные ковши»
│   │       (Header.astro, иконка — стилизованный ковш с боковым носком).
│   │   📌 Slug'и 1-в-1 с боевого (stalerOzlivochnye в названии раздела, stalerAzlivochnye в подкатегориях
│   │       — так на боевом, сохраняем для прямых 301-редиректов).
│   ├── /products/vakuumnoe-oborudovanie-dlya-termoobrabotki/  ✅ T03a · Хаб «Вакуумное оборудование для термообработки»
│   │       └── 8 карточек T05 (vacuum-* — печи/установки, обложки card-vacuum-* в цех-каноне)
│   ├── /products/gruzopodemnye-elektromagnity/       ✅ T03a · Хаб «Грузоподъёмные электромагниты» (пакет v2 09.10.2026, на сайте 16.10.2026)
│   │   ├── …/kruglye-elektromagnity-dlya-metalloloma/      ✅ T05 · Круглые для металлолома
│   │   ├── …/ovalnye-elektromagnity-dlya-metalloloma/      ✅ T05 · Овальные для металлолома
│   │   ├── …/elektromagnity-dlya-trub/                     ✅ T05 · Для стальных труб
│   │   ├── …/elektromagnity-dlya-zagotovok-i-prokata/      ✅ T05 · Для заготовок и проката
│   │   ├── …/shkafy-pitaniya-i-upravleniya/                ✅ T05 · Шкафы питания и управления
│   │   └── …/kabelnye-barabany/                            ✅ T05 · Кабельные барабаны
│   │       В меню — колонка «Доп оборудование», на главной — карточка (категория каталога). Хаб — как у стендов
│   │       (обложка, условия, карточки исполнений, «Как выбрать», вопросы, заявка), исполнения — товарные страницы
│   │       как у УИД-376 (карточка товара, «Характеристики и описание», вопросы, заявка, контакты).
│   │       Гарантия 12 месяцев (поставка из Китая): блок «Преимущества» про 18 месяцев не ставить.
│   ├── /products/zagruzochnye-telezhki-dlya-pechey/  ✅ T05 · Загрузочные тележки для печей (пакет «Доп оборудование» v2, 16.10.2026)
│   ├── /products/relsovye-transportnye-elektroplatformy/  ✅ T05 · Рельсовые транспортные электроплатформы (тот же пакет)
│   ├── /products/gazoochistka-i-rukavnye-filtry/     ✅ T05 · Газоочистка и рукавные фильтры (тот же пакет)
│   │       В меню — «Доп оборудование», на главной — карточки (категории каталога), отдельной страницы группы нет.
│   │       Товарные страницы как у УИД-376; схемы — в разделах, открываются на весь экран; задания для подбора —
│   │       /files/dop-oborudovanie/*.txt (кнопка в разделе о подборе). Гарантия 12 месяцев: блок про 18 месяцев не ставить.
│   │   ├── …/rukavnye-filtry-ui-fri/ · …/ciklony-ui-cp/ · …/skrubbery-ui-sm/   ✅ T05 · дополнительные серии (пакет МНЛЗ
│   │   │       ред. 4, 29.10.2026) — товары категории; на странице газоочистки — блок «Дополнительные серии» после
│   │   │       «Характеристик и описания». Таблица пяти исполнений рукавного фильтра — прежняя, к УИ-ФРИ не относится.
│   ├── /products/kontrolno-izmeritelnye-pribory/     ✅ T03a · Хаб «Контрольно-измерительные приборы» (16.10.2026 — со старого сайта,
│   │   │                                              куда раздел выложили 15.10 в обход платформы)
│   │   ├── …/perenosnoy-izmeritel-temperatury-rasplava/    ✅ T05 · Переносной измеритель температуры
│   │   ├── …/stacionarnyy-izmeritel-temperatury-rasplava/  ✅ T05 · Измеритель температуры с табло
│   │   ├── …/besprovodnoy-izmeritel-temperatury-rasplava/  ✅ T05 · Беспроводная система измерения
│   │   ├── …/analizator-ugleroda-kremniya-v-chugune/       ✅ T05 · Анализатор углерода и кремния
│   │   ├── …/sistema-termicheskogo-analiza-chuguna/        ✅ T05 · Термоанализатор с экраном
│   │   ├── …/pogruzhnye-termopary-i-shtangi/               ✅ T05 · Погружные термопары и штанги
│   │   ├── …/kruglye-stakanchiki-termicheskogo-analiza/    ✅ T05 · Круглые стаканчики термоанализа
│   │   └── …/kvadratnye-stakanchiki-termicheskogo-analiza/ ✅ T05 · Квадратные стаканчики термоанализа
│   │       В меню и подвале — «Доп оборудование», в корне каталога — свой раздел, на главной — карточка (категория).
│   │       Оформление нового сайта: хаб — как у стендов, приборы — товарные страницы как у УИД-376 (описательные
│   │       свойства — строками в карточке товара, блока числовых характеристик нет). Тексты — со старого сайта.
│   ├── /products/zapchasti/                            ✅ T03a · Хаб-раздел «Запчасти на оборудование» (6 групп; «Для МНЛЗ» — 29.10.2026)
│   │   ├── …/zapchasti-mnlz/                                ✅ T05 · Группа «Для МНЛЗ и обработки медных сплавов» (пакет МНЛЗ ред. 4):
│   │   │       одна страница (кристаллизаторы, индукторы, магнитопроводы, реакторы, детали станов) — подбор по чертежу
│   │   ├── …/induktsionnoe/                                 ✅ Раздел «Для индукционного оборудования» (пакет V10 + перенос из KZ, 18.09.2026)
│   │   │       └── 152 страницы: хаб, 25 узлов, 120 позиций, «Вся номенклатура» и гайды.
│   │   │          Механика та же, что у дробемётов: тёмный hero, полоса цифр, сетка узлов,
│   │   │          каталог с фильтрами по узлу и группе, поиском, сортировкой и пагинацией;
│   │   │          у позиции — фото с увеличением, быстрые характеристики, «Цена по запросу»
│   │   │          со счётчиком, вкладки, таблица исполнения, панель подбора, связанные позиции.
│   │   │          Страницы позиций лежат плоско в разделе (…/induktsionnoe/<позиция>/) —
│   │   │          как на казахстанском сайте, откуда раздел и перенесён (коммиты 3615b7c,
│   │   │          4450c71, dcc8f6d репозитория MTPK-SITE-KAZAHSTAN).
│   │   │          Стили: /css/zapchasti-catalog.css (прототип, заскоуплен в .zp) + /css/ui-spares.css
│   │   │          (справочные блоки пакета, мост .zp → .ui-spares-scope). Работает на
│   │   │          zapchasti-catalog.js, подпись источника заявки берётся из data-form.
│   │   │          Китайских подписей пакета и корзины «в заявку» в разделе нет.
│   │   └── …/drobemetnoe/                                   ✅ T03a · Подкатегория «Для дробемётного оборудования» (14 тизеров T05)
│   │           └── impeller-m · napravlyayushhaya(-m) · raspredelitel(-m) · lopatki(-m) · vkladysh-{verhnij,bokovoj,perednij,zadnij}(-m) · vkladysh-perednij-zadnij
│   │   └── …/tranzistornye/                                 ✅ Раздел «Для транзисторных установок» (пакет 18.09.2026, 18 страниц)
│   │           └── 7 подразделов: igbt-moduli (8 моделей) · platy-upravleniya · platy-drayvera ·
│   │              platy-zashchity · paneli-upravleniya · spiralnye-induktory · kondensatory (0-12-mkf) ·
│   │              плюс podbor-po-foto. Стили и скрипт пакета ограничены классом .ui-transistor-site.
│   │   ├── …/futerovochnye-smesi/                          ✅ Футеровочные смеси для индукционных печей (пакет 18.09.2026)
│   │   │       └── 15 разделов, 16 таблиц, карта набивки в /docs/. Стили пакета в классе .ui-futerovka.
│   │   │          Пакет предлагал /products/futerovochnye-smesi/ — положено в запчасти по решению Евгения.
│   │   │          ⚠ Два фото из каталогов сторонних поставщиков не публикуются до подтверждения прав.
│   │   ├── …/tigli/                                        ✅ Тигли для плавильных печей (пакет «Тигли» V7 30.10.2026; V4.3 — на сайте с 16.10.2026)
│   │   │       └── 13 страниц: grafitovye · karbidokremnievye · magnezitovye · dlya-elektropechey · s-nosikom ·
│   │   │          ovalnye · dlya-alyuminiya · grafitoglinyanye · grafitovye-s-karbidom-kremniya · komplektuyushchie ·
│   │   │          podbor-i-ekspluatatsiya · korundovye-alundovye (V7, корундовые 100–950 мл) · vybor-po-metallu (V7,
│   │   │          выбор по металлу и сплаву). 204 позиции номенклатуры — в таблицах, схема размеров рядом с таблицей.
│   │   │          HTML-блок пакета (обёртка .uc, шаблон tpl/tigli.css); заявка — окном запчастей (форма «Тигли»),
│   │   │          фото и схемы — на весь экран; картинки — /img/crucibles/. По пакету 4 страницы из 12 (хаб,
│   │   │          grafitovye, karbidokremnievye, magnezitovye) уже были на боевом сайте — адреса те же.
│   │   📌 Раздел дробемётов перестроен пакетом (18.09.2026): 242 карточки + 31 подраздел,
│   │       обновлён редакцией 11 пакета (28.09.2026, ✅ на проде): 32 подраздела, серии УИ-Т
│   │       (старый образец) и УИ-ТМ (новый) разведены — не объединять и не редиректить друг
│   │       на друга; сравнение серий и поток дроби в /turbiny/, 23 строки характеристик
│   │       в карточках турбин, у лопаток нового образца фото нет (заглушка до точного снимка).
│   │       каталог с фильтрами по узлу и модели, поиск, сортировка, пагинация.
│   │       Прежние 14 страниц перекрыты пакетом один в один — редиректы не потребовались.
│   │   📌 Этап доработок (2026-06-10): плоский хаб (18 товаров напрямую) → раздел с 2 подкатегориями по типу оборудования.
│   │       Карточки/контент — как было; URL углубился на уровень. ✅ Задеплоено на прод 2026-06-10 (/ship).
│   │       301-редиректы в nginx ПРИМЕНЕНЫ (36 location-блоков, слеш+без; смоук: старый URL → 301 → 200):
│   │       • /products/zapchasti/{tiristory-silovye,kondensatory-elektrotermicheskie,kabel-silovoj-vodoohlazhdaemyj,plata-impulsnyh-transformatorov}/ → …/zapchasti/induktsionnoe/<тот же slug>/
│   │       • /products/zapchasti/{impeller-m,napravlyayushhaya,napravlyayushhaya-m,raspredelitel,raspredelitel-m,lopatki,lopatki-m,vkladysh-verhnij,vkladysh-verhnij-m,vkladysh-bokovoj,vkladysh-bokovoj-m,vkladysh-perednij-m,vkladysh-perednij-zadnij,vkladysh-zadnij-m}/ → …/zapchasti/drobemetnoe/<тот же slug>/
│   ├── /products/sterzhnevye-mashiny/                 ✅ T03a · Хаб «Стержневые и формовочные машины» (8 моделей, 2026-07-09)
│   │   │   # каждая модель = страница-описание (cat-hero + фото + описание + full-cycle), гарантия 12 мес, таблицы ТХ добавим позже
│   │   ├── …/dvuhpozitsionnaya-vertikalnaya-goryachie-yashchiki/  ✅ Двухпозиционная вертикальная (горячий ящик)
│   │   ├── …/gorizontalnaya-goryachie-yashchiki/                  ✅ Горизонтальная (горячий ящик)
│   │   ├── …/mashina-obolochkovyh-sterzhney-goryachie-yashchiki/  ✅ Оболочковые стержни (Croning)
│   │   ├── …/vertikalnaya-holodnyy-yashchik/                      ✅ Вертикальная (холодный ящик)
│   │   ├── …/vertikalnaya-trehplitochnaya-holodnyy-yashchik/      ✅ Вертикальная трёхплиточная (холодный ящик)
│   │   ├── …/gorizontalnaya-holodnyy-yashchik/                    ✅ Горизонтальная (холодный ящик)
│   │   ├── …/formovochnaya-syrye-formy/                           ✅ Формовочная (сырые формы)
│   │   └── …/formovochnaya-bezopochnaya/                          ✅ Формовочная (безопочная)
│   ├── /products/mnlz-i-obrabotka-mednyh-splavov/     ✅ T03a · Раздел «МНЛЗ и обработка медных сплавов» (пакет ред. 4 от 29.10.2026)
│   │   │   # категория каталога, 18 товаров каталога — товарные страницы как у электромагнитов (фото, ключевые показатели,
│   │   │   # «Характеристики и описание», заявка, контакты). Карточки раздела — 6 групп; печи для алюминия — отдельно.
│   │   │   # Без гарантии, наличия, сроков и страны производства (пакет их не подтверждает). В меню — «Производственные линии».
│   │   ├── печи: …/kanalnye-pechi-ui-kp/ · …/sdvoennye-pechi-ui-pra/ · …/naklonnye-pechi-ui-kpn/      ✅ T05
│   │   ├── вытяжка: …/tyanushchaya-mashina-ui-tm1/ · …/tyanushchie-mashiny-ui-tm2/ · …/servomashiny-ui-tms/ · …/vytyazhka-shiny-ui-tmsh/  ✅ T05
│   │   ├── резка: …/otreznye-stanki-ui-os/ · …/lentochnaya-pila-ui-lps350/ · …/rubka-prutka-ui-grp/   ✅ T05
│   │   ├── пруток: …/obdirochnye-stany-ui-ops/ · …/gidravlicheskij-stan-ui-gps/ · …/cepnoj-stan-ui-cvs6/ · …/stoly-prutka-ui-sp/  ✅ T05
│   │   ├── разливка и участок: …/razlivka-slitkov-ui-ls9/ · …/meshalki-rasplava-ui-mr/ · …/podemnik-shihty-ui-psh/  ✅ T05
│   │   └── для алюминия: …/pechi-alyuminiy-ui-ipa/                                                    ✅ T05
│   ├── /products/termoobrabotka-plavka-alyuminiya/    ✅ T03a · Хаб «Термообработка и плавка алюминия» (7 моделей, T05, 2026-07-10)
│   │   │   # страницы моделей — T05 (phero + вкладки), описания и таблицы ТХ от Евгения, гарантия 12 мес
│   │   ├── …/bassejnovye-elektropechi-dlya-vyderzhki-alyuminiya/  ✅ Бассейновые электропечи (выдержка), серия BK
│   │   ├── …/gazovye-bassejnovye-pechi-dlya-vyderzhki-alyuminiya/ ✅ Газовые бассейновые (выдержка), серия BD
│   │   ├── …/gazovye-tigelnye-pechi-s-rekuperaciej-tepla/         ✅ Газовые тигельные с рекуперацией, серия BA
│   │   ├── …/naklonnye-gidravlicheskie-tigelnye-pechi/            ✅ Наклонные гидравлические тигельные, серия ВН
│   │   ├── …/pechi-dlya-plavki-i-vyderzhki-alyuminiya/            ✅ Печи плавки и выдержки (башенные), серия BF
│   │   ├── …/centralizovannye-bashennye-pechi/                   ✅ Централизованные башенные, серия BE
│   │   └── …/elektricheskie-tigelnye-pechi-soprotivleniya/       ✅ Электрические тигельные сопротивления, серия BW
│   ├── /products/termicheskie-pechi/                  ✅ T03a · Хаб «Термические печи» (переезд с /mufelnye-termicheskie-pechi/ 16.09.2026, ТЗ Pixel Tools)
│   │   │   # новый формат (Этап 3): каждая категория T04 = описание + таблица моделей
│   │   ├── …/mufelnye-pechi/                                              ✅ T04 · Муфельные электропечи УИ-МП (лаборатории; слово «муфельная» сохранено — физический муфель)
│   │   ├── …/kamernye-pechi/                                              ✅ T04 · Камерные электропечи УИ-МКП (СНО / СНЗ)
│   │   ├── …/pechi-s-vykatnym-podom/                                      ✅ T04 · С выкатным подом УИ-МПВП + таблица подбора садки (V5)
│   │   ├── …/vertikalnye-pechi/                                           ✅ T04 · Вертикальные печи УИ-МВКП
│   │   ├── …/shahtnye-pechi/                                              ✅ T04 · Шахтные электропечи УИ-МШП (СШО / СШЗ)
│   │   ├── …/pechi-s-zaschitnoy-atmosferoy/                               ✅ T04 · В защитной атмосфере УИ-МПЗА
│   │   ├── …/pechi-s-podyomnym-podom/                                     ✅ T04 · Элеваторные УИ-МПП + двухподовое исполнение УИ-МПДП (склейка с /mufelnaya-pech-s-2-podami/)
│   │   ├── …/vakuumnye-pechi/                                             ✅ T04 · Высокотемп. вакуумные УИ-МВТВП до 1800 °C
│   │   ├── …/zubotehnicheskie-pechi/                                      ✅ T04 · Зуботехнические печи УИ-МПД
│   │   ├── …/pechi-dlya-ispytaniy-na-termoudar/                           ✅ T04 · Печь МП-ИТ-1, испытания на термический шок
│   │   ├── …/fritovye-pechi/                                              ✅ T04 · Фритовые печи УИ-МФП
│   │   ├── …/trubchatye-pechi/                                            ✅ T04 · Трубчатые печи УИ-ТП (7 конструкций — разделами на этой же странице, ТЗ пакета V5)
│   │   ├── …/pechi-nepreryvnogo-deystviya/                                ✅ T0x · Печи непрерывного действия УИ-РП / УИ-СЛП / УИ-ВБП (новая, 16.09.2026, текст 19 пакета V5)
│   │   └── …/futerovka-i-nagrevateli/                                     ✅ T0x · Футеровка и выбор нагревателей — инженерный гид (новая, 16.09.2026, текст 24 пакета V5)
│   │   📷 Картинки (Этап 3, новый формат): обложки `card-muf-{slug}.jpg` × 13 + галереи `muf-{key}-N.jpg` —
│   │       ОРИГИНАЛЬНЫЕ рендеры со старого сайта, адаптированы (Pillow contain 600×450 на белом, объект не режется),
│   │       БЕЗ AI. Каждая = jpg + WebP-сосед `.jpg.webp`. (AI-обложки Этапа 2 заменены оригиналами.)
│   │   📌 Slug'и СОХРАНЕНЫ 1-в-1 с боевого (включая опечатки «vykatannym», «shahnaya») —
│   │       для прямого 1:1-маппинга 301-редиректов со старого `/products/mufelnye-termicheskiy-pechi/<slug>/`.
│   │
│   │   ─── Технологические разделы (T03b): хаб → дочерние узлы линии T05 (без уровня T04) ───
│   ├── /products/oborudovanie-dlya-peschano-glinistyh-smesej-pgs/  ✅ T03b · Раздел «Линии ПГС» (8 узлов-позиций T05)
│   ├── /products/oborudovanie-lvm/                     ✅ T03b · Раздел «Оборудование ЛВМ» (31 дочерний T05, реал. фото)
│   │       └── …/mashina-ruchnogo-litya-voska/          ✅ T05 · Машина для ручного литья воска под давлением УИ-В-140 (2026-06-19)
│   │       └── …/shpric-mashina/                        ✅ T05 · Шприц-машина (восконагнетательный пресс) УИ-В-120С (2026-06-19)
│   │       └── …/robot-izgotovleniya-obolochek-3g6r/    ✅ T05 · Робот для изготовления оболочек (3 головы, 6 рук) УИ-К-3Г6Р (2026-06-19)
│   │       └── …/robot-izgotovleniya-obolochek-4g8r/    ✅ T05 · Робот для изготовления оболочек (4 головы, 8 рук) УИ-К-4Г8Р (2026-06-19)
│   │       └── …/shestiosnyj-robot-izgotovleniya-obolochek/   ✅ T05 · Шестиосный робот для изготовления оболочек УИ-К-6О (KUKA R-2000iC/210F) (2026-06-22)
│   │       └── …/specialnaya-liniya-izgotovleniya-obolochek/  ✅ T05 · Специальная конвейерная линия для изготовления оболочек УИ-К-Л1 / YN-GZX-600Z (2026-06-22)
│   │       └── …/specialnaya-mashina-pogruzheniya/      ✅ T05 · Специальная машина для погружения УИ-К-П1 (бак-пульпопровод с мешалкой, 995 л) (2026-06-22)
│   │       └── …/barabannyj-apparat-obsypki-obolochek/      ✅ T05 · Барабанный пескоструйный аппарат (для роботов) УИ-К-Б1 — обсыпка/стомление (2026-06-22)
│   │       └── …/polnostyu-avtomaticheskij-kotel-deparafinizacii/  ✅ T05 · Полностью автоматический котёл для депарафинизации УИ-Д-А1 (электро, 333 кВт, 8 МПа) (2026-06-22)
│   │       └── …/sistema-podachi-modelnogo-voska/        ✅ T05 · Система подачи парового воска УИ-Т-П1 (пневмодозатор воска, 2,4 л) (2026-06-22)
│   │       # 10 ЛВМ-товаров выше добавлены 19–22.06.2026 (другая копия), сведены в общий источник 29.06.2026
│   ├── /products/oborudovanie-lgm/                     ✅ T03b · Раздел «Оборудование ЛГМ» (12 дочерних T05, реал. фото)
│   └── /products/linii-dlya-holodnotverdeyushhih-smesej-hts/   ✅ T03b · Раздел «Линии ХТС» (7 дочерних T05)
│       └── 7 дочерних T05 (вариант C)                  ✅ linya-regeneratsii · smesiteli · vibrostol · pnevmotransport · vibroottirochnaya-mashina · skaf-ohlazdenia · pyloylovitel
│           # картинки в цех-каноне (литейные Этап 2, 2026-06-07): обложки /img/hts-products/0X-*.jpg + галереи /img/{lr,sm,vs,pt,vr,so,py}/. 301: nginx ...-hts-2 → ...-hts (при /ship)
│           # контент дочерних T05 наполнен со старого сайта (вариант C, шаблон tovar-b.css: phero+галерея+лайтбокс, spec с ТТХ + скроллспай) — 2026-06-08, на проде
│
├── /uslugi/                                            ⬜ T13 · Корень «Услуги» (хаб)
│   ├── /uslugi/pod-kluch/                              ⬜ T06 · Литейное под ключ (план)
│   ├── /uslugi/proektirovanie/                         ⬜ T06 · Проектирование с нуля (план)
│   ├── /uslugi/montazh-shefmontazh/                    ✅ T06 · Монтаж и шефмонтаж (страница услуги, blueprint-hero)
│   ├── /uslugi/puskonaladka/                           ✅ T06 · Пусконаладка (страница услуги)
│   ├── /uslugi/obuchenie-personala/                    ✅ T06 · Обучение персонала (страница услуги, photoreal hero)
│   ├── /uslugi/modernizatsiya/                         ⬜ T06 · Модернизация (план)
│   ├── /uslugi/remont-plavilnyh-pechey/                 ✅ T06 · Ремонт плавильных печей (4 узла, аудит, контент с источника)
│   ├── /uslugi/remont-dugovyh-pechey/                   ✅ T06 · Ремонт дуговых печей (реновация ДСП, модернизация АСУ ТП, кейс+FAQ)
│   ├── /uslugi/remont-termicheskih-pechey/             ✅ T0x · Ремонт и сервис термических печей (новая, 16.09.2026, текст 22 пакета V5; ТЗ Pixel Tools просило /services/, приведено к /uslugi/ по конвенции сайта)
│   ├── /uslugi/remont-drobemetov/                       ✅ T06 · Ремонт дробемётов (3 узла: камера/турбина/пылеуловитель)
│   └── /uslugi/tehnicheskij-audit/                      ✅ T06 · Технический аудит (оценка состояния, blueprint-hero)
│
├── /proekty/                                           ✅ Раздел пересобран пакетом uralinduktor-projects (21.09.2026)
│   │   Одиннадцать подробных кейсов и реестр из 539 записей с поиском по оборудованию,
│   │   фильтрами по году, региону и работам, по 6 записей на страницу.
│   │   Данные реестра — в блоке <script id="pr-data">; скрипт /js/projects.js.
│   │   Сетка из шести кейсов и кнопка «Все проекты» стоят на главной странице сайта
│   │   и на /spasibo/ (блок .cases) — прежняя карусель на 180 проектов снята вместе
│   │   с /js/cases-data.js. Прежний адрес /proekty/allprojects/ → 301 на /proekty/.
│   └── …/<город>/ × 11                                     ✅ Подробные кейсы: pavlodar, ufa, lipetsk,
│           magnitogorsk, chelyabinsk, ekaterinburg, rybinsk, chermoz, miass, perm, kurgan. Галерея с увеличением,
│           благодарственные письма (9 PDF и 2 JPG в /files/proekty/), скрипт /js/project-case.js.
│           perm — дробемёт УИД-376 для ПК «Термо-Деталь», 2021 (добавлен 06.10.2026); kurgan — печь
│           УИ-0,35Т-300 для ООО «Зауральская сталь», май 2025 (добавлен 19.10.2026, в базе, шаблон project).
│           Новый кейс — страница в базе + связка: счётчик «X / N» в крошках у всех кейсов (сквозной),
│           карточка и цифры на хабе (сетка 3 колонки: без дыр — по модификаторам --tall/--wide),
│           письмо и число писем в описании /otzyvy/, точка на карте главной (legacy/projects-data.ts).
│       Стили пакета: /css/tpl/projects.css (.pr-) и /css/tpl/project-case.css (.ui-case) — оба
│       полностью заскоуплены, к ним дописана только обвязка ширины под сайтовый контейнер.
│       📌 Прежние 180 страниц проектов и их список сняты по решению Евгения (взять пакет целиком);
│          на все снятые адреса — 301 в redirects-legacy.map, павлодарский ведёт на новый кейс.
│          Реестр из 422 записей обезличен: без названий, ИНН, сумм и номеров документов.
├── /news/                                              ✅ T15 · Корень «Новости» (индекс-сетка cat-card)
│   └── 16 статей                                       ✅ T14 · новости (контент со старого сайта, URL 1:1)
├── /praktikum/                                         ✅ Раздел напарника · статьи по литейным и термическим процессам
│   ├── 29 статей (со справочником ниже)                ✅ страницы-документы в базе (kind=document); на хабе — 29 разборов
│   ├── /rezhimy-termoobrabotki-metallov/               ✅ справочник режимов термообработки: 50 материалов, поиск,
│   │                                                      графики (21.10.2026, пакет «РЕЖИМЫ-ТЕРМООБРАБОТКИ-v3»)
│   └── /indukcionnyy-nagrev-praktikum/ + 4 урока       ✅ под-практикум по индукционному нагреву
├── /proizvodstvo/                                      ✅ T10 · «Производство» — литейные участки под ключ
├── /nalichie/                                          ✅ T09 · «Наличие на складе» (raw-page, фильтр + JS-рендер из stock.json)
├── /kalkulyatory/                                      🟡 T18 · «Калькуляторы расчёта» (10.11.2026): вкладки плавка #plavka, расход дроби #drob, ХТС #hts; модели — из каталога; тенге
├── /o-company/                                         ✅ T11 · «О компании» (+ блок «Команда» с 12 фото)
├── /policy/                                            ✅ T12 · Политика обработки персональных данных
├── /soglasie/                                          ✅ T12 · Согласие на обработку персональных данных
└── /spasibo/                                           ✅ Служебная · экран «Спасибо» после отправки заявки (редирект из forms.js)
```

> **Раздел «Практикум»** — страницы-документы в базе (`content.pages`, kind=document): целый HTML статьи
> с местами `<site-header>`/`<site-footer>`, шапку и подвал ставит сайт; в карту сайта попадают сами.
> Новая статья — `POST /admin/v1/documents`, стили и картинки — в медиатеку (`praktikum/<статья>/assets/`),
> поведение — модулем сайта на TS (справочник режимов — `client/thermal-guide.ts`). Карточка — на хабе
> `/praktikum/` (счётчики раздела и «инженерных разборов», hasPart в разметке). До 07.10.2026 раздел
> лежал готовым HTML в `astro/public/praktikum/` (история — в git).

> **Не созданы (нет в проде):** T16 «Отзыв» `/reviews/<slug>/` (5 шт. в WP-источнике) и
> T17 «Корень отзывов» `/reviews/` — заводятся при переносе отзывов.

---

## Готовые страницы (✅)

### 1. Главная
- **URL:** `/` — https://uralinduktor.ru/
- **Прототип:** `design/prototypes/index-v7-dmgmori.html`
- **Сервер:** `/var/www/uralinduktor/public/index.html`
- **Назначение:** входная страница. Hero, показатели, форма подбора,
  «Один партнёр», каталог направлений (8 категорий), «под ключ»,
  «в наличии», сервис, модернизация, кейс, запрос КП, лизинг (6 партнёров),
  карта реализованных проектов (Yandex Maps, 165 объектов), best-offer, footer.
- **В меню:** все top-level пункты (Каталог/Услуги/Производство/Проекты/О компании).

### 2. Категория «Индукционное оборудование»
- **URL:** `/products/induktsionnoe-oborudovanie/`
- **Прототип:** `design/prototypes/category.html`
- **Назначение:** страница категории. Full-bleed hero, 7 реальных подкатегорий
  с боевого сайта, лидген с фото-плашкой, тёмный «Почему выбирают» + плитка,
  выровненные контакты с картой.
- **В меню:** «Каталог → Плавильное оборудование → Индукционные плавильные печи».

### 3. Каталог «Индукционные плавильные печи»
- **URL:** `/products/induktsionnye-plavilnye-pechi/` — https://uralinduktor.ru/products/induktsionnye-plavilnye-pechi/
- **Прототип:** `design/prototypes/catalog-induktsionnye-plavilnye-pechi.html`
- **Сервер:** `/var/www/uralinduktor/public/products/induktsionnye-plavilnye-pechi/index.html`
- **Назначение:** листинг 21 модели индукционных плавильных печей собственного
  производства. Hero с full-bleed-фото `hero-induction-melting.png` (fal.ai
  nano-banana-pro, 2026-05-24), фильтр в 2 строки (масса + мощность),
  21 карточка с реальными характеристиками, форма «получить полный каталог»,
  стандартные блоки.
- **В меню:** «Каталог → Плавка и обработка металлов → Индукционные плавильные печи».
- **Редирект:** старый URL `/products/induktsionnoe-oborudovanie/inductionye-tiristornye-pechi-po-stali/`
  → 301 → `/products/induktsionnye-plavilnye-pechi/` (nginx `location =` блок).
- **Историческое:** ранее эта же страница жила как «Печи для стали» под старым
  URL; контент тот же (тиристорные печи для чёрных металлов), переименование
  под более широкое название раздела согласно меню «Плавильное оборудование».

### 4. Карточки позиций «Индукционные плавильные печи» — 44 модели

- **Корень:** `/products/induktsionnye-plavilnye-pechi/<slug>/`
- **Шаблон:** `design/prototypes/product-<slug>.html` (генерируется из эталона `product-ui-0-1t-100.html`)
- **Сервер:** `/var/www/uralinduktor/public/products/induktsionnye-plavilnye-pechi/<slug>/index.html`
- **Дата готовности:** 2026-05-26 (массовая генерация всех 43 моделей по образцу УИ-0.1Т-100)
- **Источник контента:** боевой `uralinduktor.ru/products/induktsionnoe-oborudovanie/induktsionnye-tiristornye-pechi/<wp-slug>/` (44 страницы)
- **Старые URL → 301:** все 43 длинных WP URL `/products/induktsionnoe-oborudovanie/induktsionnye-tiristornye-pechi/induktsionnaya-tiristornaya-pech-*` редиректятся nginx-блоком (`/etc/nginx/sites-available/uralinduktor` — section `# 301: legacy WP product URLs (43 furnaces)`) на новые короткие URL.
- **Структура страницы:** идентична `product-ui-0-1t-100.html` (см. ниже п. 4a) — phero (5-слайдная галерея 1=bucket-render + 4 фото), 8-разделный spec, catalog-cta, partner, adv, best-offer.
- **Картинки:** 1-й слайд — bucket-рендер по массе (`/img/catalog-furnace-bucket-{s|m|l|xl|xxl}.png`), 2-5 слайды — реальные фото с боевого WP (78 уникальных файлов в `/img/<slug>-photo-N.{jpg|png}`); для 21 модели без своих WP-фото — fallback на shared `/img/ui-0-1t-100-photo-2..5.jpg`.
- **Тексты:** description boilerplate подставляется по шаблону с заменой названия модели / массы / мощности / типа металла. Технические характеристики (10 строк) подтягиваются из specs scrape JSON.
- **44 модели по металлу:**
  - **Сталь / чугун (19):** ui-0-1t-100, ui-0-15t-160, ui-0-25t-160, ui-0-25t-250, ui-0-35t-300, ui-0-5t-400, ui-0-75t-500, ui-1t-800, ui-1-5t-1200, ui-2t-1200, ui-2t-1600, ui-3t-2400, ui-5t-3000, ui-5t-4000, ui-6t-3600, ui-8t-4800, ui-10t-6000, ui-12t-7000, ui-15t-8500. ✅ Дубли канонизированы (2026-09): 9 страниц «на гидравлике» и `ui-1t-800-0-7kgts` удалены, на них стоят постраничные 301 на базовые модели (`server/redirects-legacy.map`). Механизм наклона (редукторный / гидравлический) указан на самой странице модели — отдельных URL под исполнение больше нет.
  - **Медь / латунь / бронза (12):** ui-0-1t-100m, ui-0-15t-100m, ui-0-25t-200m, ui-0-35t-250m, ui-0-5t-350m, ui-0-75t-500m, ui-1t-600m, ui-1-5t-800m, ui-2t-1000m, ui-3t-1500m, ui-5t-2500m, ui-10t-3500m.
  - **Алюминий (11):** ui-0-1t-100a, ui-0-15t-100a, ui-0-25t-160a, ui-0-35t-200a, ui-0-5t-250a, ui-0-75t-350a, ui-1t-500a, ui-1-5t-750a, ui-2t-900a, ui-2-5t-1200a, ui-3t-1500a.
- **Тех. долг:** статус позиций задан универсально «Под заказ · 30–45 дней» (кроме УИ-0.1Т-100 — «Со склада в Миассе»). Уточнять под клиента; при необходимости — индивидуально править phero__status в каждом файле или сделать stock-flag в JSON.

### 4b. Подраздел «Транзисторные печи (IGBT)» — 14 моделей (2026-06-16)

- **Категория:** `/products/induktsionnye-plavilnye-pechi/tranzistornye/` (T04, шаблон из po-stali, фильтр масса+мощность по транзисторной шкале).
- **Товары:** `/products/induktsionnye-plavilnye-pechi/tranzistornye/<slug>/` (T05, эталон ui-0-1t-100: phero-галерея + lightbox + 8-разделный spec).
- **Источник контента:** боевой `uralinduktor.ru/products/induktsionnoe-oborudovanie/induktsionnye-tranzistornye-pechi/<wp-slug>/`.
- **Фото:** реальные снимки узлов со старого сайта (НЕ цех-канон) — сознательное исключение из правила №9 CLAUDE.md, согласовано с Евгением 2026-06-16. Тизер хаба `card-pech-tranzistor.png` — цех-канон (перерисовка фото УИ-160п через /product-image).
- **Генераторы:** `scripts/build-tranzistornye-models.py` (14 страниц) + `scripts/build-tranzistornye-category.py` (категория из po-stali).
- **Старые URL → 301 (ПРИМЕНЕНО на проде 2026-06-16, nginx-блок `# 301: legacy WP transistor furnaces (14)` в `/etc/nginx/sites-available/uralinduktor`):**
  - категория: `/products/induktsionnoe-oborudovanie/induktsionnye-tranzistornye-pechi/` → `/products/induktsionnye-plavilnye-pechi/tranzistornye/`
  - модели: `…/induktsionnye-tranzistornye-pechi/induktsionnaya-tranzistornaya-pech-<wp>/` → `…/tranzistornye/<slug>/`,
    где wp→slug: ui-1p→ui-1p, ui-2p→ui-2p, ui-3p→ui-3p, ui-5pz→ui-5p, ui-8pz→ui-8p, ui-10pz→ui-10p, ui-15p→ui-15p, ui-25p→ui-25p, ui-35p→ui-35p, ui-45p→ui-45p, ui-70p→ui-70p, ui-90p→ui-90p, ui-110p→ui-110p, ui-160p→ui-160p.
- **14 моделей:** ui-1p, ui-2p, ui-3p, ui-5p, ui-8p, ui-10p (настольные, цветные/драгметаллы, 30–80 кГц, без наклона) · ui-15p, ui-25p, ui-35p, ui-45p, ui-70p, ui-90p, ui-110p, ui-160p (сталь+цветные, 1–20 кГц, редукторный наклон).

### 4b. Хаб «Индукционные нагреватели»
- **URL:** `/products/induktsionnye-nagrevateli/` — https://uralinduktor.ru/products/induktsionnye-nagrevateli/
- **Прототип:** `design/prototypes/catalog-induktsionnye-nagrevateli.html` (на основе `catalog-drobemetnoe-oborudovanie.html`)
- **Сервер:** `/var/www/uralinduktor/public/products/induktsionnye-nagrevateli/index.html`
- **Дата готовности:** 2026-05-26
- **Назначение:** хаб-каталог 5 категорий индукционных нагревателей (как плавильные печи — `po-stali/…`). Hero `hero-heaters.png`, stats (12 лет / 45 моделей / 1 день отклик / 18 мес гарантия), catalog-intro 3 блока (сервис и ЗИП / 5 категорий под задачу / полный цикл), 5 teaser-карточек категорий, section-divider, applications, full-cycle, leadgen, why-us, best-offer. CSS — общий `/css/tpl/hub-catalog.css` (как у остальных хабов).
- **В меню:** «Каталог → Плавка и обработка металлов → Индукционные нагреватели» (ссылается на хаб).
- **Контент-источник:** https://uralinduktor.ru/products/induktsionnye-nagrevateli/.
- **Перестройка ТЗ-2 п.6 (2026-06-07):** было 8 внутренних типов одним плоским гридом
  с фильтром → стало 5 категорий-подразделов со своими landing-страницами (как
  плавильные печи). Товары перенесены под свою категорию, URL
  `/induktsionnye-nagrevateli/<категория>/<товар>/`. 9 транзисторных УИ-…Н удалены
  по решению Евгения. Слияния: ВЧ 30-80 + 30-100 → `vysokochastotnye`;
  СВЧ 100-250 + 50-1100 → `sverhvysokochastotnye`; сканирующая закалка →
  `ustanovki-zakalki-valov`.
- **5 категорий (landing-страницы):**
  1. **Среднечастотные** (5 моделей УИ-АВн) → `/srednechastotnye/` ✅
  2. **Высокочастотные** (11 моделей УИ-АВз + УИ-2-АВЗ) → `/vysokochastotnye/` ✅
  3. **Ручные ВЧ на гибком кабеле** (6 моделей УИ-ЛН, 9 страниц: у 15/25/35 два исполнения — базовая внешнее, `-vo` встроенное) → `/ruchnye/` ✅
  4. **Сверхвысокочастотные** (12 моделей УИ-АВ/АB + УИ-АВВ) → `/sverhvysokochastotnye/` ✅
  5. **Установки поверхностной закалки валов** (5 моделей УИ-СЗ) → `/ustanovki-zakalki-valov/` ✅
- **Характеристики/названия/описания (2026-06-08, на проде):** все 45 карточек приведены 1:1 к
  боевому uralinduktor.ru (полные таблицы характеристик пофетчены со старого сайта).
  Исправлены реальные ошибки: ручные ЛН (мощность = номер модели → реальная), СВЧ
  (частота по моделям вместо обобщённой), УИ-1500СЗ (длина 1800→1500), убран дубль
  key-specs «Гарантия». Картинки раздела уже готовы (главная = цех-рендер серии +
  4 реальных фото модели в лайтбоксе) — генерация не требуется (решение 2026-06-08).
- **Картинки teaser:** переиспользованы существующие `card-<slug>.png` (те же, что были у карточек товаров; уже на проде).

### 4a. Эталонная карточка «УИ-0.1Т-100»
- **URL:** `/products/induktsionnye-plavilnye-pechi/ui-0-1t-100/` — https://uralinduktor.ru/products/induktsionnye-plavilnye-pechi/ui-0-1t-100/
- **Прототип:** `design/prototypes/product-ui-0-1t-100.html` (на базе эталона `product-uid-376e.html`)
- **Сервер:** `/var/www/uralinduktor/public/products/induktsionnye-plavilnye-pechi/ui-0-1t-100/index.html`
- **Старый URL (301):** `/products/induktsionnoe-oborudovanie/induktsionnye-tiristornye-pechi/induktsionnaya-tiristornaya-pech-ui-0-1t-100/` → новый
- **Дата готовности:** 2026-05-25 (переезд под каталог плавильных печей + редизайн под единый product-шаблон)
- **Назначение:** карточка позиции «Индукционная тиристорная печь УИ-0.1Т-100». Структура — копия эталона УИД-376Е:
  phero (5-слайдная галерея с lightbox: 1-й — рендер `plavilnye-uzel-realistic-logo.png`, 2-5 — реальные фото в цеху заказчика с боевого uralinduktor.ru),
  key-specs 2×2 (100 кг · 100 кВт · 380/50 В·Гц · 1 кГц), 2 CTA, 3 факта (отгрузка/плавка/гарантия+КПД 95 %),
  spec-секция без табов (sticky TOC + 8 stacked-разделов: Основные характеристики (10 строк) /
  Описание (тиристорный преобразователь, состав плавильного комплекса из 6 узлов + опции) /
  Гарантии / Монтаж / Обучение / Сервис / Запчасти / Лизинг — адаптированы под индукционную печь),
  catalog-cta mid-page «Подготовим лучшее предложение», partner (5 пилонов), adv (4), best-offer как на главной.
- **Статус позиции:** «Со склада в Миассе».
- **Изображения:** см. `picture.md` — `picture/products/induktsionnye-plavilnye-pechi/ui-0-1t-100/` (5 файлов, 681–824 KB каждый).
- **Особенности:** в каталоге `catalog-induktsionnye-plavilnye-pechi.html` все 3 ссылки на УИ-0.1Т-100 обновлены на короткий URL. В nginx добавлен `location =` 301-блок со старого длинного URL.

> _Историческое:_ предыдущий прототип `design/prototypes/product.html` остался как архив старого формата (с JS-табами). Не использовать для новых страниц — эталон теперь `product-uid-376e.html` / `product-ui-0-1t-100.html`.

### 5. Хаб «Дробемётное оборудование»
- **URL:** `/products/drobemetnoe-oborudovanie/` — https://uralinduktor.ru/products/drobemetnoe-oborudovanie/
- **Прототип:** `design/prototypes/catalog-drobemetnoe-oborudovanie.html`
- **Сервер:** `/var/www/uralinduktor/public/products/drobemetnoe-oborudovanie/index.html`
- **Назначение:** хаб-каталог направлений дробемётного оборудования.
  Hero `hero-shotblast.png` (gpt-image-2-edit на основе реального фото
  проходной установки в цеху Миасса), stats-strip (4 показателя),
  catalog-intro (3 блока: производство в РФ / типы установок / полный цикл),
  9 hub-тизеров категорий (4:3 крупная картинка + название + короткая
  подпись + «Подробнее →»), section-divider, applications (6 задач),
  full-cycle, leadgen, why-us, best-offer.
- **В меню:** «Каталог → Плавка и обработка металлов → Дробемётные установки».
- **9 категорий** на хабе (с подписями назначения):
  1. Кранового типа → `/products/drobemetnoe-oborudovanie/kranovogo-tipa/` (✅ готова, 1 карточка УИД-376Е)
  2. Барабанного типа → `/products/drobemetnoe-oborudovanie/barabannogo-tipa/` (✅ готова, 10 карточек)
  3. С вращающимся столом → `/products/drobemetnoe-oborudovanie/s-vrashchayushchimsya-stolom/` (✅ готова, 4 карточки)
  4. Для очистки швеллера, двутавра и сорта → `/products/drobemetnoe-oborudovanie/dlya-shvellera-i-sorta/` (✅ готова, 12 моделей УИД для проката)
  5. Проходные подвесного типа → `/products/drobemetnoe-oborudovanie/prokhodnye-podvesnogo-tipa/` (✅ готова, 4 карточки)
  6. Для очистки труб → `/products/drobemetnoe-oborudovanie/dlya-ochistki-trub/` (✅ готова, 5 карточек УИДТ)
  7. С ленточным сетчатым конвейером → `/products/drobemetnoe-oborudovanie/s-lentochnym-konveyerom/` (✅ готова, 4 карточки УИД)
  8. С выкатным столом → `/products/drobemetnoe-oborudovanie/s-vykatnym-stolom/` (✅ готова, 4 карточки УИД-76)
  9. Передвижные дробемётные машины → `/products/drobemetnoe-oborudovanie/peredvizhnye/` (✅ готова, 3 карточки BH)
- **Картинки категорий:** 9 GPT-Image-2-edit рендеров (`card-baraban.png`,
  `card-stol.png`, `card-shveller.png`, `card-podves.png`, `card-truby.png`,
  `card-lenta.png`, `card-vykatnoy.png`, `card-peredvizhnoy.png`,
  `product-card-shotblast.png` для кранового). Спецификация:
  `design/decisions/category-cards-photoreal-spec.md`.
- **История:** ранее на хабе было 12 карточек включая «Турбина», «Запчасти»,
  «Рольганги» — убраны по решению заказчика. Также первоначально хаб
  работал как catalog-list с 22 моделями + фильтр — переделан в hub-style
  с 9 категорийными тизерами и крупными картинками.

### 6. Каталог «Дробемёты кранового типа»
- **URL:** `/products/drobemetnoe-oborudovanie/kranovogo-tipa/` — https://uralinduktor.ru/products/drobemetnoe-oborudovanie/kranovogo-tipa/
- **Прототип:** `design/prototypes/catalog-drobemetnye-ystanovki-kran-tip.html`
- **Сервер:** `/var/www/uralinduktor/public/products/drobemetnoe-oborudovanie/kranovogo-tipa/index.html`
- **Старые URL (301):**
  `/drobemetnye-ystanovki-kran-tip/` → новый URL
  `/drobometnii-ystanovki-kran-tip/` → новый URL (опечатка в legacy-слаге)
- **Назначение:** листинг 9 моделей УИД кранового типа с реальными
  характеристиками с боевого uralinduktor.ru (24,9–102,2 кВт, 6–60 т/ч).
  Hero `hero-shotblast.png` (тот же что у хаба), stats, фильтр в 2 строки
  (Мощность 4 диапазона + Производительность 4 диапазона), 9 pcard-карточек
  с уникальными картинками `model-uid-*.png` (см. picture.md), 1 section-divider,
  applications «Под какие изделия» (6 карточек: литые корпуса / поковки /
  сварные конструкции / под покраску / упрочнение / нестандартные изделия),
  full-cycle, leadgen, why-us, best-offer.
- **В меню:** «Каталог → Плавка и обработка металлов → Дробемётные установки →
  Кранового типа» (через хаб).
- **9 моделей:** УИД-376 (24,9 кВт · 6 т/ч), УИД-376Е, УИД-378 (41,35 · 12),
  УИД-378Е, УИД-3710 (49,35 · 12), УИД-3710Е (50 · 30), УИД-3720 (68 · 30),
  УИД-3720Е, УИД-3750 (102,2 · 60). Все характеристики реальные с боевого.
- **Тех. долг:** ~~ссылки «Подробнее о позиции» в карточках ведут на
  `#leadgen` (заглушка)~~ — **закрыто 2026-05-25**: все 9 ссылок в каталоге
  теперь ведут на индивидуальные product-страницы (`uid-376`, `uid-376e`,
  `uid-378`, `uid-378e`, `uid-3710`, `uid-3710e`, `uid-3720`, `uid-3720e`, `uid-3750`).

### 6a. Карточка товара «УИД-376Е» (первая product-страница проекта)
- **URL:** `/products/drobemetnoe-oborudovanie/kranovogo-tipa/uid-376e/`
- **Прототип:** `design/prototypes/product-uid-376e.html`
- **Сервер:** `/var/www/uralinduktor/public/products/drobemetnoe-oborudovanie/kranovogo-tipa/uid-376e/index.html`
- **Назначение:** референсная карточка позиции; шаблон для остальных 140+
  product-страниц. Структура: phero (галерея 5 фото — 1 рендер
  `model-uid-376e.png` + 4 реальных фото с боевого `uid-376e-photo-1..4.jpg`
  с lightbox по клику, навигацией ←/→/ESC/swipe), key-specs grid (4 цифры:
  6 т/ч · 24,9 кВт · ⌀800×1200 мм · 2×1000 кг), spec-секция без табов
  (sticky TOC слева + 8 разделов stacked с горизонтальными разделителями:
  Характеристики / Описание / Гарантии / Монтаж / Обучение / Сервис / Запчасти /
  Лизинг), catalog-cta best-offer mid-page, partner pillars (5), adv (4),
  best-offer как на главной (контакты + форма «Подготовим лучшее предложение»).
- **Изображения:** см. `picture.md` — `uid-376e-gallery/` (4 реальных фото)
  + `model-uid-376e.png` (CAD-аккуратный рендер v2).
- **Дизайн-решения, зафиксированные на этой странице:**
  - Табы характеристик заменены на stacked-разделы с sticky-TOC (нет JS-табов).
  - Карточки разделов без рамок и фона — только горизонтальные линии.
  - Lightbox для галереи с keyboard/swipe навигацией.
  - Best-offer как финальный блок (как на главной), без отдельного блока «обсудим задачу».
- **Дата готовности:** 2026-05-25.

### 6b. Карточки товаров остальных 8 моделей кранового типа
- **Дата:** 2026-05-25
- **Прототипы:** `design/prototypes/product-uid-376.html`,
  `product-uid-378.html`, `product-uid-378e.html`, `product-uid-3710.html`,
  `product-uid-3710e.html`, `product-uid-3720.html`, `product-uid-3720e.html`,
  `product-uid-3750.html`.
- **URL и сервер:**
  | Модель | URL | Сервер |
  |---|---|---|
  | УИД-376 | `/products/drobemetnoe-oborudovanie/kranovogo-tipa/uid-376/` | `/var/www/uralinduktor/public/products/drobemetnoe-oborudovanie/kranovogo-tipa/uid-376/index.html` |
  | УИД-378 | `…/uid-378/` | `…/uid-378/index.html` |
  | УИД-378Е | `…/uid-378e/` | `…/uid-378e/index.html` |
  | УИД-3710 | `…/uid-3710/` | `…/uid-3710/index.html` |
  | УИД-3710Е | `…/uid-3710e/` | `…/uid-3710e/index.html` |
  | УИД-3720 | `…/uid-3720/` | `…/uid-3720/index.html` |
  | УИД-3720Е | `…/uid-3720e/` | `…/uid-3720e/index.html` |
  | УИД-3750 | `…/uid-3750/` | `…/uid-3750/index.html` |
- **Старые WP URL (301 редиректы через nginx, см. `/etc/nginx/sites-available/uralinduktor`):**
  - `uralinduktor.ru/products/drobemetnoe-oborudovanie/drobometnii-ystanovki-kran-tip/drobemetnaya-ustanovka-kranovogo-tipa-uid-376/` → `…/kranovogo-tipa/uid-376/`
  - аналогично для всех 8 моделей; для УИД-378E старый WP URL содержит `-2` на конце (`…uid-378e-2/`), редирект приводит к `…/uid-378e/`.
  - дополнительно есть catch-all для любого другого URL под старым `drobometnii-ystanovki-kran-tip/`.
- **Назначение:** product-страницы 8 моделей УИД кранового типа. Используют
  тот же шаблон что и УИД-376Е (см. п.6a): phero с галереей (3D-рендер +
  реальные фото с боевого uralinduktor.ru, lightbox), key-specs grid, spec
  раздел с sticky-TOC из 8 разделов (Характеристики / Описание / Гарантии /
  Монтаж / Обучение / Сервис / Запчасти / Лизинг), best-offer mid-page,
  partner pillars, adv, best-offer финальный.
- **Изображения галерей:** см. `picture.md` — `picture/products/drobemetnoe-oborudovanie/uid-<slug>-gallery/`.
  Количество фото: УИД-376/378/378E/3710/3710E — 4 шт., УИД-3720/3720E — 3 шт.,
  УИД-3750 — 2 шт. + 1 рендер модели `model-uid-<slug>.png` в каждой карточке.
  Для случаев меньше 5 thumbs CSS `phero__thumbs` переопределён локально
  на нужное `repeat(N, 1fr)`.
- **Catalog-страница:** в `catalog-drobemetnye-ystanovki-kran-tip.html`
  все 9 моделей ведут на свои product-URL (раньше 8 моделей вели на `#leadgen`).

### 6c. Каталог «Дробемёты барабанного типа»
- **URL:** `/products/drobemetnoe-oborudovanie/barabannogo-tipa/` — https://uralinduktor.ru/products/drobemetnoe-oborudovanie/barabannogo-tipa/
- **Прототип:** `design/prototypes/catalog-barabannogo-tipa.html`
- **Сервер:** `/var/www/uralinduktor/public/products/drobemetnoe-oborudovanie/barabannogo-tipa/index.html`
- **Дата:** 2026-05-25
- **Старые WP URL (301):**
  - `/products/drobemetnoe-oborudovanie/drobemetnye-ustanovki-barabannogo-tipa/` → новый URL
  - `…/drobemetnye-ustanovki-barabannogo-tipa/<anything>` (catch-all fallback) → новая категория
- **Назначение:** листинг 10 моделей УИД барабанного типа для серийной очистки
  мелких деталей россыпью (метизы, мелкие отливки, штамповки, поковки).
  Hero `hero-shotblast.png` (общий с кран-тип), stats (10 моделей / 0,3–14 т/ч /
  6,4–65 кВт / 800–10 500 м³/ч), фильтр в 2 строки (Мощность 4 диапазона
  до 10 / 10-20 / 20-50 / 50+ кВт + Производительность 4 диапазона до 1 /
  1-3 / 3-10 / 10+ т/ч), 10 pcard-карточек с реальными характеристиками,
  section-divider, applications «Под какие изделия» (6 карточек: метизы /
  мелкие отливки / мелкие поковки / штамповки / пружины-наклёп / под покраску),
  full-cycle, leadgen, why-us, best-offer.
- **В меню:** «Каталог → Плавка и обработка металлов → Дробемётные установки →
  Барабанного типа» (через хаб).
- **10 моделей:** УИД-320 (7·0,3), УИД-322 (6,4·0,5), УИД-324 (10,85·0,7),
  УИД-326 (13,25·1,2), УИД-3110 (9,7·1), УИД-3113 (11,1·2), УИД-3210 (28,45·2,5),
  УИД-3220 (46·5), УИД-15 с метал. лентой (50·6), УИД-28 с метал. лентой (65·14).
- **Технический долг (для следующих итераций):** реальные фото моделей со
  старого WP-сайта используются как hero на product-страницах, но это всего
  4 уникальных кадра, разделённых между 10 моделями (см. ниже). Для большей
  визуальной дифференциации в будущем — отрисовать уникальные рендеры
  каждой модели через fal.ai (как сделано для кран-серии `model-uid-*.png`).

### 6d. Карточки товаров барабанного типа (10 шт.)
- **Дата:** 2026-05-25
- **Прототипы:** `design/prototypes/product-uid-320.html`, `product-uid-322.html`,
  `product-uid-324.html`, `product-uid-326.html`, `product-uid-3110.html`,
  `product-uid-3113.html`, `product-uid-3210.html`, `product-uid-3220.html`,
  `product-uid-15.html`, `product-uid-28.html`.
- **URL и сервер:**
  | Модель | URL | Сервер |
  |---|---|---|
  | УИД-320 | `…/barabannogo-tipa/uid-320/` | `…/uid-320/index.html` |
  | УИД-322 | `…/barabannogo-tipa/uid-322/` | `…/uid-322/index.html` |
  | УИД-324 | `…/barabannogo-tipa/uid-324/` | `…/uid-324/index.html` |
  | УИД-326 | `…/barabannogo-tipa/uid-326/` | `…/uid-326/index.html` |
  | УИД-3110 | `…/barabannogo-tipa/uid-3110/` | `…/uid-3110/index.html` |
  | УИД-3113 | `…/barabannogo-tipa/uid-3113/` | `…/uid-3113/index.html` |
  | УИД-3210 | `…/barabannogo-tipa/uid-3210/` | `…/uid-3210/index.html` |
  | УИД-3220 | `…/barabannogo-tipa/uid-3220/` | `…/uid-3220/index.html` |
  | УИД-15 | `…/barabannogo-tipa/uid-15/` | `…/uid-15/index.html` |
  | УИД-28 | `…/barabannogo-tipa/uid-28/` | `…/uid-28/index.html` |
- **Старые WP URL (301 редиректы через nginx, см. `/etc/nginx/sites-available/uralinduktor`):**
  - `…/drobemetnaya-ustanovka-barabannogo-tipa-uid-XXX/` → `…/barabannogo-tipa/uid-XXX/`
  - Спец-кейсы: `…-uid-326-2/` (с -2 на WP) → `…/uid-326/`;
    `…-s-metallicheskoj-lentoj-uid-15/` → `…/uid-15/`;
    `…-s-metallicheskoj-lentoj-uid-28/` → `…/uid-28/`.
  - Catch-all для любого другого URL под старым `drobemetnye-ustanovki-barabannogo-tipa/`.
- **Назначение:** product-страницы 10 моделей УИД барабанного типа. Используют
  тот же шаблон что и УИД-376Е (см. п.6a): phero с галереей, key-specs grid,
  spec раздел с sticky-TOC из 8 разделов (Характеристики / Описание / Гарантии /
  Монтаж / Обучение / Сервис / Запчасти / Лизинг), best-offer mid-page,
  partner pillars, adv, best-offer финальный.
- **Изображения:** все 10 моделей используют hero-фото со старого WP-сайта
  (1 фото на модель, без полной галереи как у кран-серии). Уникальных кадров
  всего 4 — они разделены между моделями по физической схожести:
  - `photo_2025-11-27_13-06-59.png` → УИД-320 / -322 / -324 (мелкие модели с открытой загрузкой)
  - `photo_2025-11-27_11-21-26-2.png` → УИД-326 / -3210 (средние с закрытой камерой)
  - `photo_2025-11-27_12-34-07.jpg` → УИД-3110 / -3113 (галтовочные)
  - `photo_2025-11-27_13-20-18-1.png` → УИД-3220 / -15 / -28 (большие с металлической лентой)
  Файлы переименованы под модель: `/img/uid-<slug>-photo-1.{png,jpg}?v=1`.
  Блок `phero__thumbs` скрыт (`display: none`) — на одной картинке он не нужен.
- **Ключевые характеристики (4 цифры в phero-keyspecs):** производительность т/ч,
  мощность кВт, производительность вентиляции м³/ч, разовая загрузка камеры кг.
  Этим отличается от кран-серии где 4-я цифра — тельферы и габарит изделия.
- **Спец-таблица:** 9 строк (производительность / мощность / вентиляция /
  разовая загрузка / макс. вес одной детали / принцип очистки / напряжение /
  режим работы / управление) против 10 строк у кран-серии (там добавлены
  тельферы и габариты).
- **Catalog-страница:** в `catalog-barabannogo-tipa.html` все 10 моделей
  ведут на свои product-URL.
- **TODO:** в будущем — сгенерировать 10 уникальных fal.ai-рендеров каждой
  модели (как сделано для кран-серии `model-uid-*.png`), чтобы убрать
  визуальное дублирование фото на product-страницах и pcard-карточках каталога.

### 6e. Каталог «Дробемёты с вращающимся столом»
- **URL:** `/products/drobemetnoe-oborudovanie/s-vrashchayushchimsya-stolom/` — https://uralinduktor.ru/products/drobemetnoe-oborudovanie/s-vrashchayushchimsya-stolom/
- **Прототип:** `design/prototypes/catalog-s-vrashchayushchimsya-stolom.html`
- **Сервер:** `/var/www/uralinduktor/public/products/drobemetnoe-oborudovanie/s-vrashchayushchimsya-stolom/index.html`
- **Дата:** 2026-05-26
- **Старые WP URL (301 редиректы через nginx):**
  - `/products/drobemetnoe-oborudovanie/drobemetnye-ustanovki-s-vrashhayushhimsya-stolom/` → новый URL
  - `…/drobemetnye-ustanovki-s-vrashhayushhimsya-stolom/<anything>` (catch-all fallback) → новая категория
- **Назначение:** каталог-страница подкатегории «С вращающимся столом» (4 модели УИД).
  Шаблон тот же, что у `catalog-barabannogo-tipa.html`:
  cat-hero (полотно тёмное, фон `/img/card-stol.png?v=4`), breadcrumb (4 уровня),
  stats-strip (4 показателя: 4 модели / 2–5 т/ч / 18–46 кВт / 2,8–5,2 тыс. м³/ч),
  s-head «Модельный ряд», catalog-filter (мощность до&nbsp;25 / 25–35 / 35–50;
  производительность до&nbsp;2 / 2–3 / 3–4 / 4+), pcard-grid из 4 карточек,
  section-divider, applications (6 задач: средние литые корпуса, крышки и плиты,
  шестерни, фланцы, средние сварные узлы, под покраску), full-cycle, leadgen,
  why-us, best-offer.
- **Типовые изделия раздела:** средние литые корпуса (редукторы, насосы), крышки
  и плиты, шестерни и зубчатые колёса после термообработки, фланцы и соединительные
  элементы, средние сварные узлы под покраску.

### 6f. Карточки товаров с вращающимся столом (4 шт.)
- **URLs (4):**
  | Модель | URL | Сервер |
  |---|---|---|
  | УИД-3512 | `…/s-vrashchayushchimsya-stolom/uid-3512/` | `…/uid-3512/index.html` |
  | УИД-3515 | `…/s-vrashchayushchimsya-stolom/uid-3515/` | `…/uid-3515/index.html` |
  | УИД-3518 | `…/s-vrashchayushchimsya-stolom/uid-3518/` | `…/uid-3518/index.html` |
  | УИД-3525 | `…/s-vrashchayushchimsya-stolom/uid-3525/` | `…/uid-3525/index.html` |
- **Старые WP URL (301 через nginx):**
  - `…/drobemetnaya-ustanovka-s-vrashhayushhimsya-stolom-uid-3512/` → `…/s-vrashchayushchimsya-stolom/uid-3512/`
  - Аналогично для 3515, 3518, 3525.
  - Catch-all для любого другого URL под старым `drobemetnye-ustanovki-s-vrashhayushhimsya-stolom/`.
- **Назначение:** product-страницы 4 моделей УИД с вращающимся столом. Используют
  тот же шаблон, что и УИД-376Е (см. п. 6a): phero с галереей,
  key-specs grid (производительность т/ч, мощность кВт, вентиляция м³/ч,
  диаметр стола Ø × грузоподъёмность), spec-раздел с sticky-TOC из 8 разделов
  (Характеристики / Описание / Гарантии / Монтаж / Обучение / Сервис / Запчасти /
  Лизинг), catalog-cta, partner pillars, adv, best-offer.
- **Изображения:** все 4 модели используют `/img/card-stol.png?v=4` (исходник —
  `picture/products/drobemetnoe-oborudovanie/card-stol.png`). Уникальных фото со
  старого WP-сайта нет. Блок `phero__thumbs` скрыт (`display: none`).
- **Ключевые характеристики моделей:**
  | Модель | Мощность, кВт | Производительность, т/ч | Вентиляция, м³/ч | Ø стола, мм | Грузоподъёмность стола, кг |
  |---|---|---|---|---|---|
  | УИД-3512 | 18,25 | 2 | 2 800 | 1 200 | 500 |
  | УИД-3515 | 22 | 3 | 3 500 | 1 500 | 800 |
  | УИД-3518 | 32,85 | 4 | 3 100 | 1 800 | 1 200 |
  | УИД-3525 | 45,9 | 5 | 5 200 | 2 500 | 2 000 |
- **Принцип работы (общий для всех 4):** деталь укладывается на круглый перфорированный
  стол, стол вращается вокруг вертикальной оси; турбины расположены сверху и сбоку
  и обрабатывают деталь дробью со всех сторон за один батч-цикл (5–15 минут).
- **TODO:** в будущем — сгенерировать 4 уникальных fal.ai-рендера каждой модели
  и реальные фото со старого WP/из цеха для phero-галерей.

### 6g. Каталог «Дробемёты для швеллера, двутавра и сорта»
- **URL:** `/products/drobemetnoe-oborudovanie/dlya-shvellera-i-sorta/` — https://uralinduktor.ru/products/drobemetnoe-oborudovanie/dlya-shvellera-i-sorta/
- **Прототип:** `design/prototypes/catalog-dlya-shvellera-i-sorta.html`
- **Сервер:** `/var/www/uralinduktor/public/products/drobemetnoe-oborudovanie/dlya-shvellera-i-sorta/index.html`
- **Дата:** 2026-05-26 (первая версия) → 2026-05-26 (рефакторинг: 1 серия с таблицей → 12 отдельных product-страниц)
- **Старые WP URL (301 редиректы через nginx):**
  - `/products/drobemetnoe-oborudovanie/drobemetnye-ustanovki-dlya-ochistki-shvellera-dvutavra-i-sorta/` → новый URL
  - `/products/drobemetnoe-oborudovanie/drobemetnye-ustanovki-dlya-ochistki-shvellera/` (короткая legacy-форма, использовалась на хабе) → новый URL
  - `/products/drobemetnoe-oborudovanie/dlya-shvellera-i-sorta/uid-prokat/` → каталог (старая страница серии с таблицей 12 типоразмеров, удалена при рефакторинге)
  - Catch-all WP-префиксов покрыт regex с `(/.*)?$`.
- **Назначение:** каталог-страница подкатегории «Для швеллера, двутавра и сорта».
  Шаблон каталога — копия `catalog-barabannogo-tipa.html` (тот же, что и у других подкатегорий дробемётов):
  cat-hero (тёмное полотно, фон `/img/card-shveller.png?v=4`), breadcrumb (4 уровня:
  Главная / Каталог / Дробемётное оборудование / Для швеллера, двутавра и сорта),
  stats-strip (4 показателя: 12 типоразмеров / 0,5–2,0 м/мин / 80–135 кВт / 14 000–36 500 м³/ч),
  s-head «Серия УИД для металлопроката · 12 типоразмеров», catalog-filter (мощность
  80–85 / 110–130 / 125–135 кВт; турбины 6 / 8 / 10 / 12), pcard-grid из **12 карточек**
  (каждая ведёт на свою product-страницу, у всех общая обложка `/img/card-shveller.png?v=4`),
  section-divider, applications (6 типов проката: швеллер У5–У40, двутавр Б10–Б100,
  уголок, листовой прокат, круг и квадрат, сварные металлоконструкции),
  full-cycle, leadgen, why-us, best-offer.
- **Hero/pcard картинка:** `card-shveller.png?v=4` (используется и как фон cat-hero,
  и как обложка всех 12 pcard-карточек подкатегории).
- **История рефакторинга (2026-05-26):** изначально подкатегория была реализована
  как 1 крупная карточка → 1 product-страница «Серия УИД для проката» с таблицей
  12 типоразмеров внутри. По решению заказчика — переделано в 12 отдельных
  product-страниц, чтобы каждый типоразмер имел собственный SEO-friendly URL,
  чтобы менеджеры могли пересылать прямую ссылку на конкретную модель в КП.
  Старая `uid-prokat` страница удалена, nginx 301 со старого URL → каталог.

### 6h. Карточки товаров для металлопроката (12 шт.)
- **Дата:** 2026-05-26
- **Прототипы:** `design/prototypes/product-uid-<slug>.html` × 12 файлов
  (slugs: `uid-1500-1000`, `uid-1500-1200`, `uid-1700-1200`, `uid-1900-1000`, `uid-1900-1200`,
  `uid-2300-1200`, `uid-2300-1400`, `uid-2500-1000`, `uid-2500-1200`, `uid-2500-1400`,
  `uid-2800-1200`, `uid-3800-1700`).
- **URLs (12):**
  | Модель | URL | Сервер |
  |---|---|---|
  | УИД-1500/1000 | `…/dlya-shvellera-i-sorta/uid-1500-1000/` | `…/uid-1500-1000/index.html` |
  | УИД-1500/1200 | `…/dlya-shvellera-i-sorta/uid-1500-1200/` | `…/uid-1500-1200/index.html` |
  | УИД-1700/1200 | `…/dlya-shvellera-i-sorta/uid-1700-1200/` | `…/uid-1700-1200/index.html` |
  | УИД-1900/1000 | `…/dlya-shvellera-i-sorta/uid-1900-1000/` | `…/uid-1900-1000/index.html` |
  | УИД-1900/1200 | `…/dlya-shvellera-i-sorta/uid-1900-1200/` | `…/uid-1900-1200/index.html` |
  | УИД-2300/1200 | `…/dlya-shvellera-i-sorta/uid-2300-1200/` | `…/uid-2300-1200/index.html` |
  | УИД-2300/1400 | `…/dlya-shvellera-i-sorta/uid-2300-1400/` | `…/uid-2300-1400/index.html` |
  | УИД-2500/1000 | `…/dlya-shvellera-i-sorta/uid-2500-1000/` | `…/uid-2500-1000/index.html` |
  | УИД-2500/1200 | `…/dlya-shvellera-i-sorta/uid-2500-1200/` | `…/uid-2500-1200/index.html` |
  | УИД-2500/1400 | `…/dlya-shvellera-i-sorta/uid-2500-1400/` | `…/uid-2500-1400/index.html` |
  | УИД-2800/1200 | `…/dlya-shvellera-i-sorta/uid-2800-1200/` | `…/uid-2800-1200/index.html` |
  | УИД-3800/1700 | `…/dlya-shvellera-i-sorta/uid-3800-1700/` | `…/uid-3800-1700/index.html` |
- **Старые URL (301):** `…/dlya-shvellera-i-sorta/uid-prokat/` (старая страница серии
  с таблицей 12 типоразмеров) → каталог `…/dlya-shvellera-i-sorta/`. См. nginx
  `location =` блок.
- **Назначение:** product-страницы 12 моделей УИД серии для металлопроката. Используют
  тот же шаблон, что и УИД-376Е (см. п. 6a): phero с **6-слайдной галереей** + lightbox
  (1-й кадр — фото `uid-prokat-photo-2.png` с логотипом «УралИндуктор» и листом проката;
  thumbs: `card-shveller.png?v=4` рендер + `uid-prokat-photo-1..5.png`),
  key-specs grid 2×2 (размер окна Ш×В мм / общая мощность кВт / кол-во и мощность турбин /
  скорость подачи 0,5–2,0 м/мин), spec-раздел с sticky-TOC из 8 разделов:
  Характеристики (10-строчная таблица под конкретную модель) / Описание (с параграфом
  «Позиция в серии» — для какого размера проката оптимальна эта модель) / Гарантии /
  Монтаж и пусконаладка / Обучение / Сервис / Запчасти / Лизинг.
  Далее catalog-cta, partner, adv, best-offer.
- **Особенность — 6-слайдная галерея:** В отличие от других серий, у швеллер-серии 6 thumbs
  (а не 5 как у УИД-376Е). Реализовано через локальный inline-style override:
  `<div class="phero__thumbs" style="grid-template-columns: repeat(6, 1fr);">`.
  Lightbox-counter `lb-total` обновлён с «5» на «6».
- **Изображения:** все 12 моделей **используют одни и те же общие фото** (по решению
  заказчика — модели серии визуально похожи, отличия только в габарите камеры).
  См. `picture.md` — `picture/products/drobemetnoe-oborudovanie/uid-prokat-gallery/`.
  На сервере: `/img/uid-prokat-photo-1..5.png` + `/img/card-shveller.png?v=4`.
- **Реальные характеристики 12 моделей** (из таблицы заказчика):
  - **Общие для всех:** мощность одной турбины 11–15 кВт, скорость подачи 0,5–2,0 м/мин,
    длина проката до 12 м, напряжение 380 В / 50 Гц, режим автоматический, управление
    ПЛК + сенсорный экран.
  - **Различия по типоразмерам** (модель → размер детали Ш×В×Д мм / размер окна / турбины /
    общая мощность кВт / макс. вес кг/м / пылеуловитель м³/ч (кВт)):
    - УИД-1500/1000 → 1200×800×12000 / 1500×1000 / 6 шт / 80–85 / 800 / 14 000 (15)
    - УИД-1500/1200 → 1200×1000×12000 / 1500×1200 / 6 шт / 80–85 / 800 / 14 000 (15)
    - УИД-1700/1200 → 1400×1000×12000 / 1700×1200 / 8 шт / 80–85 / 800 / 21 500 (22)
    - УИД-1900/1000 → 1600×800×12000 / 1900×1000 / 8 шт / 110–130 / 800 / 21 500 (22)
    - УИД-1900/1200 → 1600×1000×12000 / 1900×1200 / 8 шт / 110–130 / 1000 / 21 500 (22)
    - УИД-2300/1200 → 2000×1000×12000 / 2300×1200 / 8 шт / 110–130 / 1000 / 21 500 (22)
    - УИД-2300/1400 → 2000×1200×12000 / 2300×1400 / 8 шт / 110–130 / 1000 / 21 500 (22)
    - УИД-2500/1000 → 2200×800×12000 / 2500×1000 / 8 шт / 125–135 / 1000 / 29 800 (30)
    - УИД-2500/1200 → 2200×1000×12000 / 2500×1200 / 8 шт / 125–135 / 1500 / 29 800 (30)
    - УИД-2500/1400 → 2200×1200×12000 / 2500×1400 / 10 шт / 125–135 / 1500 / 29 800 (30)
    - УИД-2800/1200 → 2500×1000×12000 / 2800×1200 / 10 шт / 125–135 / 1500 / 29 800 (30)
    - УИД-3800/1700 → 3500×1500×12000 / 3800×1700 / 12 шт / 125–135 / 2000 / 36 500 (37)
- **Catalog-страница:** в `catalog-dlya-shvellera-i-sorta.html` все 12 моделей ведут
  на свои product-URL. Filter работает по data-атрибутам `data-power` (диапазон
  мощности) и `data-turbines` (количество турбин).
- **Скрипт генерации:** `/tmp/gen-shveller-products.py` — Python-скрипт, который при
  первоначальной разработке скопировал базовый шаблон (был `product-uid-prokat.html`
  до удаления) и сделал систематические замены по 12 моделям (title / meta / breadcrumb /
  phero / spec-osnovnye / spec-opisanie). При необходимости пересборки — можно
  использовать любой существующий `product-uid-*.html` файл этой серии как «новый
  базовый шаблон» (структура у всех 12 идентична, отличается только параметрами модели).
- **TODO:** в будущем — сгенерировать 12 уникальных fal.ai-рендеров каждой модели
  (как сделано для кран-серии `model-uid-*.png`), чтобы убрать визуальное дублирование
  фото на product-страницах и pcard-карточках каталога.

### 6i. Каталог «Дробемёты проходные подвесного типа»
- **URL:** `/products/drobemetnoe-oborudovanie/prokhodnye-podvesnogo-tipa/` — https://uralinduktor.ru/products/drobemetnoe-oborudovanie/prokhodnye-podvesnogo-tipa/
- **Прототип:** `design/prototypes/catalog-prokhodnye-podvesnogo-tipa.html`
- **Сервер:** `/var/www/uralinduktor/public/products/drobemetnoe-oborudovanie/prokhodnye-podvesnogo-tipa/index.html`
- **Дата:** 2026-05-26
- **Старые WP URL (301 редиректы через nginx):**
  - `/products/drobemetnoe-oborudovanie/drobemetnye-ustanovki-prohodnye-podvesnogo-tipa/` → новый URL
  - `/products/drobemetnoe-oborudovanie/drobemetnye-ustanovki-prokhodnye-podvesnogo-tipa/` (катч-олл для альт. транслитерации) → новый URL
  - Оба покрыты catch-all regex `(/.*)?$`
- **Назначение:** каталог-страница подкатегории «Проходные подвесного типа» (4 модели УИД).
  Шаблон тот же, что у `catalog-s-vrashchayushchimsya-stolom.html`:
  cat-hero (тёмное полотно, фон `/img/card-podves.png?v=2`), breadcrumb (4 уровня),
  stats-strip (4 показателя: 4 модели · 600–1000 мм ширина детали · 1400–1500 мм
  высота · 4–6 × 260 кг/мин расход дроби), s-head «Модельный ряд», catalog-filter
  (объём детали: до 700×1400 / 700–900×1400–1500 / 900+ ×1500; турбины: 4 / 6),
  pcard-grid из 4 карточек, section-divider, applications (6 задач: экскаваторные
  стрелы и рукояти, литые рамы и кузова, сварные металлоконструкции, оси-валы-
  лонжероны, мостовые балки, под покраску и упрочнение), full-cycle, leadgen,
  why-us, best-offer.
- **Типовые изделия раздела:** крупногабаритные детали сложной геометрии — экскаваторные
  стрелы и рукояти, литые рамы и кузова машин, сварные металлоконструкции, оси,
  валы, лонжероны, мостовые балки, детали под покраску и упрочнение.

### 6j. Карточки товаров проходные подвесного типа (4 шт.)
- **Дата:** 2026-05-26
- **Прототипы:** `design/prototypes/product-uid-383.html`, `product-uid-384.html`,
  `product-uid-485.html`, `product-uid-4810.html`.
- **URLs (4):**
  | Модель | URL | Сервер |
  |---|---|---|
  | УИД-383 | `…/prokhodnye-podvesnogo-tipa/uid-383/` | `…/uid-383/index.html` |
  | УИД-384 | `…/prokhodnye-podvesnogo-tipa/uid-384/` | `…/uid-384/index.html` |
  | УИД-485 | `…/prokhodnye-podvesnogo-tipa/uid-485/` | `…/uid-485/index.html` |
  | УИД-4810 | `…/prokhodnye-podvesnogo-tipa/uid-4810/` | `…/uid-4810/index.html` |
- **Назначение:** product-страницы 4 моделей УИД проходного подвесного типа. Используют
  тот же шаблон, что и УИД-376Е (см. п. 6a): phero с 5-слайдной галереей и lightbox
  (1-й кадр и thumb — рендер `card-podves.png?v=2`, thumbs 2-5 — реальные фото
  из локального архива заказчика `uid-podves-photo-1..4.png`), key-specs grid 2×2
  (Объём детали Ш×В мм / Турбины × расход дроби кг/мин / Принцип «Монорельс O-типа» /
  Длина детали до 12 000 мм), spec-раздел с sticky-TOC из 8 разделов:
  Характеристики (10-строчная таблица под конкретную модель) / Описание (с параграфом
  «Позиция в серии») / Гарантии / Монтаж / Обучение / Сервис / Запчасти / Лизинг.
  Далее catalog-cta, partner, adv, best-offer.
- **Ключевые характеристики моделей:**
  | Модель | Объём детали Ш×В, мм | Расход дроби кг/мин | Длина детали, мм |
  |---|---|---|---|
  | УИД-383 | 600 × 1400 | 4 × 260 | до 12 000 |
  | УИД-384 | 800 × 1500 | 6 × 260 | до 12 000 |
  | УИД-485 | 900 × 1400 | 4 × 260 | до 12 000 |
  | УИД-4810 | 1000 × 1500 | 6 × 260 | до 12 000 |
- **Принцип работы (общий для всех 4):** деталь навешивается на крюки монорельсового
  цепного конвейера O-типа, проходит через камеру в непрерывном (потоковом) режиме;
  турбины расположены сверху и по бокам, обрабатывают деталь дробью со всех сторон.
  Пылеуловитель размещён над камерой (экономия площади). Футеровка камеры —
  марганцовистая сталь + плитовая обкладка.
- **Изображения:** все 4 модели используют общую галерею: рендер `card-podves.png?v=2`
  как hero и 1-й thumb, плюс 4 реальных фото `uid-podves-photo-1..4.png?v=1` из
  локального архива заказчика (см. `picture.md` — `uid-podves-gallery/`).
- **Catalog-страница:** в `catalog-prokhodnye-podvesnogo-tipa.html` все 4 модели ведут
  на свои product-URL. Filter работает по data-атрибутам `data-power` (ширина детали)
  и `data-perf` (количество турбин).
- **Скрипт генерации:** `/tmp/gen-podves.py` — Python-скрипт, который скопировал
  эталонные шаблоны и сделал систематические замены под 4 модели.
- **TODO:** в будущем — сгенерировать 4 уникальных fal.ai-рендера каждой модели
  (как сделано для кран-серии `model-uid-*.png`), чтобы убрать визуальное дублирование
  hero-картинки и обложек pcard-карточек каталога.

### 6k. Каталог «Дробемёты для очистки труб»
- **URL:** `/products/drobemetnoe-oborudovanie/dlya-ochistki-trub/` — https://uralinduktor.ru/products/drobemetnoe-oborudovanie/dlya-ochistki-trub/
- **Прототип:** `design/prototypes/catalog-dlya-ochistki-trub.html`
- **Сервер:** `/var/www/uralinduktor/public/products/drobemetnoe-oborudovanie/dlya-ochistki-trub/index.html`
- **Дата:** 2026-05-26
- **Старые WP URL (301):** `/products/drobemetnoe-oborudovanie/drobemetnye-ustanovki-dlya-ochistki-trub(/.*)?$` → новый
- **Назначение:** каталог-страница подкатегории «Для очистки труб» (5 моделей УИДТ).
  Hero-фон `/img/card-truby.png?v=3`, breadcrumb 4 уровня, stats (5 моделей · 60–1500 мм
  диаметр · 1,0–2 м/мин скорость · 2–4 × 250–350 кг/мин расход), catalog-filter
  (диаметр труб до 300 / 300–800 / 800+; турбин 2 / 4), 5 pcard-карточек, section-divider,
  applications (6 задач: магистральные трубопроводы, котельные трубы, кузнечные заготовки,
  нефтегазовые трубы под антикор, толстостенные машиностроительные трубы, трубы под цинкование/ЛКМ).

### 6l. Карточки товаров для очистки труб (5 шт.)
- **URLs:**
  | Модель | URL | Сервер |
  |---|---|---|
  | УИДТ-20 | `…/dlya-ochistki-trub/uidt-20/` | `…/uidt-20/index.html` |
  | УИДТ-30 | `…/dlya-ochistki-trub/uidt-30/` | `…/uidt-30/index.html` |
  | УИДТ-50 | `…/dlya-ochistki-trub/uidt-50/` | `…/uidt-50/index.html` |
  | УИДТ-100 | `…/dlya-ochistki-trub/uidt-100/` | `…/uidt-100/index.html` |
  | УИДТ-150 | `…/dlya-ochistki-trub/uidt-150/` | `…/uidt-150/index.html` |
- **Назначение:** product-страницы 5 моделей серии УИДТ для очистки труб. Шаблон —
  копия УИД-376Е (см. п. 6a): phero с 6-слайдной галереей (рендер `card-truby.png?v=3` +
  5 реальных фото `uid-truby-photo-1..5.png?v=1`), key-specs 2×2 (диаметр труб /
  турбины × расход дроби / скорость продольной подачи / принцип «Конический ролик»),
  spec-раздел из 8 разделов.
- **Реальные характеристики:**
  | Модель | Диаметр труб, мм | Турбины × расход кг/мин | Скорость м/мин |
  |---|---|---|---|
  | УИДТ-20 | 60 – 114 | 2 × 250 | 1 – 1,5 |
  | УИДТ-30 | 70 – 300 | 2 × 250 | 1,5 – 2 |
  | УИДТ-50 | 150 – 800 | 2 × 280 | 1,5 – 2 |
  | УИДТ-100 | 350 – 1000 | 4 × 250 | 1 – 1,5 |
  | УИДТ-150 | до 1500 | 2 × 350 | 1 – 1,5 |
- **Принцип работы:** труба подаётся по коническому роликовому конвейеру с вращением
  вокруг собственной оси; турбины расположены по краям, обрабатывают поверхность со
  всех сторон. Замкнутый цикл подачи абразива с автоматической рекуперацией.

### 6m. Каталог «Дробемёты с ленточным сетчатым конвейером»
- **URL:** `/products/drobemetnoe-oborudovanie/s-lentochnym-konveyerom/` — https://uralinduktor.ru/products/drobemetnoe-oborudovanie/s-lentochnym-konveyerom/
- **Прототип:** `design/prototypes/catalog-s-lentochnym-konveyerom.html`
- **Сервер:** `/var/www/uralinduktor/public/products/drobemetnoe-oborudovanie/s-lentochnym-konveyerom/index.html`
- **Дата:** 2026-05-26
- **Старые WP URL (301):** `/products/drobemetnoe-oborudovanie/drobemetnye-ustanovki-prohodnye-s-gorizontalnym-lentochnym-setchatym-konvejerom(/.*)?$`
  и `/products/drobemetnoe-oborudovanie/drobemetnye-ustanovki-s-lentochnym-konveyerom(/.*)?$` → новый
- **Назначение:** каталог 4 моделей УИД с горизонтальным сетчатым конвейером (УИД-60/80/100/120).
  Hero-фон `/img/card-lenta.png?v=3`, stats (4 модели · 600–1200 мм ширина конвейера ·
  0,5–4 м/мин скорость · 4 × 120–260 кг/мин расход), filter (ширина 600/800/1000/1200; расход дроби 120/180/260),
  4 pcard-карточки, applications (6 задач: мелкое литьё россыпью, штамповки и поковки малого размера,
  метизы и крепёж россыпью, тонкостенные отливки, заготовки под покраску в потоке, метизы пружинные на наклёп).

### 6n. Карточки товаров с ленточным конвейером (4 шт.)
- **URLs:** UID-60 / UID-80 / UID-100 / UID-120.
- **Реальные характеристики:**
  | Модель | Ширина конвейера, мм | Скорость, м/мин | Расход дроби кг/мин |
  |---|---|---|---|
  | УИД-60 | 600 | 0,5 – 4 | 4 × 120 |
  | УИД-80 | 800 | 0,5 – 4 | 4 × 120 |
  | УИД-100 | 1000 | 0,5 – 4 | 4 × 180 |
  | УИД-120 | 1200 | 0,5 – 4 | 4 × 260 |
- **Принцип работы:** двусторонняя обработка (2 турбины сверху + 2 снизу) мелких деталей россыпью на сетке.
- **Изображения:** главное фото `phero__main` = `/img/card-lenta.png?v=3`, thumbs 2-6 — реальные фото
  `uid-lenta-photo-1..5.png?v=1` (6-thumb grid override).

### 6o. Каталог «Дробемёты с выкатным столом»
- **URL:** `/products/drobemetnoe-oborudovanie/s-vykatnym-stolom/` — https://uralinduktor.ru/products/drobemetnoe-oborudovanie/s-vykatnym-stolom/
- **Прототип:** `design/prototypes/catalog-s-vykatnym-stolom.html`
- **Сервер:** `/var/www/uralinduktor/public/products/drobemetnoe-oborudovanie/s-vykatnym-stolom/index.html`
- **Дата:** 2026-05-26
- **Старые WP URL (301):** `/products/drobemetnoe-oborudovanie/drobemetnye-ustanovki-s-vykatnym-stolom(/.*)?$` → новый
- **Назначение:** каталог 4 моделей УИД-76 для крупногабаритных деталей весом до 30 тонн.
  Hero-фон `/img/card-vykatnoy.png?v=3`, stats (4 модели · 5–30 тонн грузоподъёмность ·
  до 4×3 м размер детали · 30–60 т/ч производительность), filter (грузоподъёмность
  5/10/20/30 т; турбин 2/3/4), 4 pcard, applications (6 задач: крупное литьё, большие
  сварные конструкции, рамы тяжёлой техники, корпуса насосов и компрессоров,
  шестерни большого диаметра, тяжёлые поковки).

### 6p. Карточки товаров с выкатным столом (4 шт.)
- **URLs:** UID-765 / UID-7610 / UID-7620 / UID-7630.
- **Реальные характеристики:**
  | Модель | Размер детали, мм | Грузоподъёмность, кг | Мощность, кВт | Производительность, т/ч | Расход дроби |
  |---|---|---|---|---|---|
  | УИД-765 | 2000 × 1000 | до 5 000 | 35,8 | 30 | 2 × 260 |
  | УИД-7610 | 2500 × 1500 × 280 | до 10 000 | 188,45 | 45 | 3 × 260 |
  | УИД-7620 | 4000 × 3000 × 700 | до 20 000 | 183,35 | 60 | 4 × 260 |
  | УИД-7630 | 4000 × 2000 | до 30 000 | 83,2 | 60 | 4 × 260 |
- **Принцип работы:** деталь укладывается на выкатной вращающийся стол, который заезжает
  в камеру; вращение обеспечивает очистку со всех сторон.
- **Изображения:** главное фото = `/img/card-vykatnoy.png?v=3`, thumbs 2-4 — реальные фото
  `uid-vykatnoy-photo-1..3.png?v=1` (4-thumb grid override). Только 3 уникальных фото в
  локальном архиве заказчика.

### 6q. Каталог «Передвижные дробемётные машины»
- **URL:** `/products/drobemetnoe-oborudovanie/peredvizhnye/` — https://uralinduktor.ru/products/drobemetnoe-oborudovanie/peredvizhnye/
- **Прототип:** `design/prototypes/catalog-peredvizhnye.html`
- **Сервер:** `/var/www/uralinduktor/public/products/drobemetnoe-oborudovanie/peredvizhnye/index.html`
- **Дата:** 2026-05-26
- **Старые WP URL (301):** `/products/drobemetnoe-oborudovanie/peredvizhnye-drobemetnye-mashiny(/.*)?$` → новый
- **Назначение:** каталог 3 моделей серии BH — **самоходных** дробемётных машин для
  подготовки больших горизонтальных поверхностей к окрашиванию. Деталь не приносится
  к установке — установка едет по детали. Hero-фон `/img/card-peredvizhnoy.png?v=3`,
  stats (3 модели · 270–850 мм ширина очистки · 40–120 м²/ч · 0,5–20 м/мин скорость),
  filter (ширина очистки 270/550/850; производительность 40/80/120), 3 pcard,
  applications (6 задач: стальные листы и плиты, бетонные полы под промышленные
  покрытия, корабельные палубы, мостовые балки на месте монтажа, ангары и резервуары,
  дороги и взлётные полосы).

### 6r. Карточки товаров передвижных машин (3 шт.)
- **URLs:** BH270 / BH550 / BH850.
- **Реальные характеристики:**
  | Модель | Мощность, кВт | Ширина очистки, мм | Производительность, м²/ч | Габариты Д×Ш×В, мм | Вес, кг |
  |---|---|---|---|---|---|
  | BH270 | 17,95 | 270 | 40 | 1900 × 380 × 1100 | 370 |
  | BH550 | 29,75 | 550 | 80 | 1950 × 720 × 1130 | 680 |
  | BH850 | 41,25 | 850 | 120 | 2050 × 1050 × 1250 | 820 |
- **Общее для всех 3:** 380 В / 50 Гц, скорость движения 0,5–20 м/мин, ходовой мотор 0,75 кВт,
  расход абразива ≤ 100 г/м², замкнутый цикл рекуперации с встроенной системой пылеподавления.
- **Принцип работы:** центробежная турбина разгоняет абразив, машина перемещается по
  обрабатываемой поверхности на собственном ходу.
- **Изображения:** главное фото = `/img/card-peredvizhnoy.png?v=3`, thumbs 2-6 — реальные фото
  `uid-peredvizhnoy-photo-1..5.png?v=1` (6-thumb grid override).

> **Финальный коммит (2026-05-26):** все 9 подкатегорий хаба дробемётного оборудования
> закрыты. Каталоги: кранового / барабанного / с вращающимся столом / для швеллера и
> сорта / проходные подвесного типа / для очистки труб / с ленточным конвейером / с
> выкатным столом / передвижные. Итого по 9 каталогам — 60 product-страниц.

### 5.x [исторический пункт]
- **URL:** `/products/oborudovanie-lvm/`
- **Прототип:** `design/prototypes/category-lvm.html`
- **Дата редизайна:** 2026-05-24 (полная пересборка)
- **Hero-картинка:** `picture/products/oborudovanie-lvm/lvm-hero-realistic.png`
  (сгенерирована через fal.ai · модель **gpt-image-2**, 16:9, реалистичный
  кадр оператора у модельного автомата с тёплым amber + холодным teal светом)
- **Назначение:** ключевая страница позиционирования продуктового направления ЛВМ.
  Архитектура из 10 контентных блоков + контакты:
  1. **Hero** (full-bleed dark + новое фото)
  2. **KPI-стрип** под hero (30–50% / 90% / 8 узлов / 5–9 мес)
  3. **4 проблемы ЛВМ → решения** (SUBTLE, 2×2 карточки)
  4. **3 сценария** (PAGE, Медицина / Точные запчасти / Запуск с нуля)
  5. **8 узлов оборудования** (SUBTLE, grid 4×2 с иконками)
  6. **Производство в РФ** ⭐ (DARK + image overlay, главный нарратив:
     Проектируем → Изготавливаем → Монтируем и обслуживаем + 3 бонуса:
     гарантия 18 мес, ЗИП в Миассе, документы для аудита)
  7. **Экономика воска** (PAGE, таблица сравнения + большая цифра 90% + ROI)
  8. **План — 4 шага** (SUBTLE, timeline 5–9 мес)
  9. **Лидген** (SUBTLE + tech-grid, light форма с textarea «описание задачи»)
  10. **FAQ** (PAGE, 7 вопросов в `<details>` accordion)
  11. Контакты
- **Источник контента:** https://uralinduktor.ru/products/oborudovanie-lvm/
  (rich-content версия исходного сайта)
- **В меню:** «Каталог → Технологии → ЛВМ».

### 7. Хаб «Системы охлаждения»
- **URL:** `/products/sistemy-ohlazhdeniya/` — https://uralinduktor.ru/products/sistemy-ohlazhdeniya/
- **Прототип:** `design/prototypes/catalog-sistemy-ohlazhdeniya.html`
- **Сервер:** `/var/www/uralinduktor/public/products/sistemy-ohlazhdeniya/index.html`
- **Дата:** 2026-05-26
- **Назначение:** хаб-каталог 2 подкатегорий промышленных систем охлаждения для металлургии и литейных производств. Hero `/img/hero-cooling.png?v=1` (16:9, градирня + чиллер + трубы в цеху), stats-strip (35 моделей / 10 градирен / 25 чиллеров / 900 000 кКал/ч), catalog-intro (3 блока: производство в Миассе / замкнутый цикл градирня+чиллер / срок 30–45 дней + ресурс 15 лет), 2 hub-тизера категорий (4:3 крупная картинка + подзаголовок с диапазоном), section-divider, applications (6 типовых сценариев: индукционные печи / лазеры и сварка / литейные машины / гидравлика / прокатные станы / сварочные генераторы), full-cycle, leadgen, why-us, best-offer.
- **В меню:** «Каталог → Плавка и обработка металлов → Системы охлаждения» (header partial обновлён + sync применён ко всем прототипам).
- **Контент-источник:** https://uralinduktor.ru/products/sistemy-ohlazhdeniya/ — 2 подкатегории с 35 моделями.
- **2 hub-карточки:**
  1. Градирни УИГ → `/gradirni/` (10 моделей, 50 000–900 000 кКал/ч, 8–61,5 кВт)
  2. Чиллеры УИЧ → `/chillery/` (25 моделей, 1 316–85 303 кКал/ч, 0,68–33,7 кВт)
- **Картинки teaser:** 3 PNG в `picture/products/sistemy-ohlazhdeniya/` — `hero-cooling.png` (16:9 для хаба), `card-gradirni.png` (4:3 hub-карточка градирен), `card-chillery.png` (4:3 hub-карточка чиллеров). На сервере: `/img/hero-cooling.png?v=1`, `/img/card-gradirni.png?v=1`, `/img/card-chillery.png?v=1`.

### 7a. Каталог «Градирни УИГ»
- **URL:** `/products/sistemy-ohlazhdeniya/gradirni/` — https://uralinduktor.ru/products/sistemy-ohlazhdeniya/gradirni/
- **Прототип:** `design/prototypes/catalog-gradirni.html`
- **Сервер:** `/var/www/uralinduktor/public/products/sistemy-ohlazhdeniya/gradirni/index.html`
- **Дата:** 2026-05-26
- **Старые WP URL (301 редиректы через nginx):**
  - `/products/sistemy-ohlazhdeniya/cooling-towers(/.*)?` → `/products/sistemy-ohlazhdeniya/gradirni/`
- **Назначение:** каталог-страница подкатегории «Градирни УИГ» (10 моделей).
  Шаблон тот же, что у других каталогов дробемётов: cat-hero (тёмное полотно, фон `/img/card-gradirni.png?v=1`),
  breadcrumb (4 уровня: Главная / Каталог / Системы охлаждения / Градирни УИГ),
  stats-strip (10 моделей / 50 000–900 000 кКал/ч / 8–61,5 кВт / ресурс 15 лет),
  catalog-filter (Мощность: до 15 / 15–30 / 30+ кВт; Охлаждение: до 200 000 / 200–500 / 500+ тыс. кКал/ч),
  pcard-grid из 10 карточек (каждая ведёт на свой product-URL), section-divider,
  applications (6 сценариев: индукционные печи / гидравлика / прокатные станы / дробемёты / компрессоры / замкнутый контур цеха),
  full-cycle, leadgen, why-us, best-offer.
- **10 моделей:** УИГ-10Т (50 000·8), УИГ-20Т (100 000·8), УИГ-30Т (150 000·15), УИГ-40Т (200 000·18), УИГ-60Т (250 000·18), УИГ-80Т (400 000·24), УИГ-100Т (450 000·32), УИГ-120Т (500 000·33), УИГ-160Т (800 000·39), УИГ-200Т (900 000·61,5). Формат: кКал/ч · кВт.
- **Общие параметры всех моделей:** напряжение 380 В / 50 Гц, защита IP54, материал — оцинкованная сталь с порошковой окраской, утеплитель PE-RT/PIR, ресурс корпуса 15 лет, гарантия 18 месяцев.

### 7b. 10 карточек товаров градирен УИГ
- **Дата:** 2026-05-26
- **Прототипы:** `design/prototypes/product-uig-{10t,20t,30t,40t,60t,80t,100t,120t,160t,200t}.html`
- **URLs (10):** `…/sistemy-ohlazhdeniya/gradirni/uig-<slug>/`
- **Назначение:** product-страницы 10 моделей УИГ. Шаблон — копия `product-uid-383.html`. Phero с 5-фото-галереей и lightbox (1-й слайд — наш рендер `card-gradirni.png`, slides 2–5 — общие фото с подсерии `gradirni-photo-1..4.png`), key-specs grid 2×2 (охлаждение кКал/ч · мощность кВт · габариты Д×Ш×В · масса кг), spec раздел со sticky-TOC из 8 разделов (Основные характеристики 12 строк · Описание с принципом двухконтурной работы и позиции в серии · Гарантии · Монтаж · Обучение · Сервис · Запчасти · Лизинг), catalog-cta, partner, adv, best-offer.
- **Изображения главного фото каждой страницы:** наш рендер `/img/card-gradirni.png?v=1` (одинаковый для всех 10 моделей).
- **Изображения galleries:** 4 общих фото `/img/gradirni-photo-1..4.png?v=1` — сконвертированы из реальных фото со старого WP/из цеха (`picture/products/sistemy-ohlazhdeniya/gradirni-gallery/`).

### 7c. Каталог «Чиллеры УИЧ»
- **URL:** `/products/sistemy-ohlazhdeniya/chillery/` — https://uralinduktor.ru/products/sistemy-ohlazhdeniya/chillery/
- **Прототип:** `design/prototypes/catalog-chillery.html`
- **Сервер:** `/var/www/uralinduktor/public/products/sistemy-ohlazhdeniya/chillery/index.html`
- **Дата:** 2026-05-26
- **Старые WP URL (301 редиректы через nginx):**
  - `/products/sistemy-ohlazhdeniya/chillers(/.*)?` → `/products/sistemy-ohlazhdeniya/chillery/`
- **Назначение:** каталог-страница подкатегории «Чиллеры УИЧ» (25 моделей).
  Cat-hero (тёмное полотно, фон `/img/card-chillery.png?v=1`), breadcrumb (4 уровня),
  stats-strip (25 моделей / 1 316–85 303 кКал/ч / 0,68–33,7 кВт / питание 220 или 380 В),
  catalog-filter (Мощность: до 5 / 5–15 / 15+ кВт; Холод: до 10 / 10–30 / 30+ тыс. кКал/ч),
  pcard-grid из 25 карточек, section-divider,
  applications (6 сценариев: лазеры / литейные машины / сварочные генераторы / индукционные нагреватели / гальванические линии / прокат и ЧПУ),
  full-cycle, leadgen, why-us, best-offer.
- **25 моделей:** УИЧ-005 — УИЧ-30В. Модели «В» (УИЧ-03В, -04В, -05В, -06В, -08В, -10В, -12В, -15В, -20В, -25В, -30В) — с инверторным компрессором: больше холода при меньшем энергопотреблении.
- **pcard__badge:** для версий «В» — «Чиллер УИЧ · «В»», для стандартных — «Чиллер УИЧ».

### 7d. 25 карточек товаров чиллеров УИЧ
- **Дата:** 2026-05-26
- **Прототипы:** `design/prototypes/product-uich-{005,01,02,03,03v,04,04v,05,05v,06,06v,08,08v,10,10v,12,12v,15,15v,20,20v,25,25v,30,30v}.html`
- **URLs (25):** `…/sistemy-ohlazhdeniya/chillery/uich-<slug>/`
- **Назначение:** product-страницы 25 моделей УИЧ. Шаблон — копия `product-uid-383.html`. Phero с 5-фото-галереей и lightbox (1-й слайд — наш рендер `card-chillery.png`, slides 2–5 — общие фото `chillery-photo-1..4.png`), key-specs grid 2×2 (холод кКал/ч · мощность кВт · давление контура МПа · штуцера), spec раздел из 8 разделов: основные характеристики (12 строк, для серии «В» — дополнительная строка «Тип компрессора: Инверторный»), описание с принципом парокомпрессионного цикла и параграфом про серию «В», стандартные блоки (гарантии, монтаж, обучение, сервис, запчасти, лизинг).
- **Изображения главного фото каждой страницы:** `/img/card-chillery.png?v=1` (одинаковый для всех 25 моделей).
- **Изображения galleries:** 4 общих фото `/img/chillery-photo-1..4.png?v=1` — сконвертированы из реальных фото `picture/products/sistemy-ohlazhdeniya/chillery-gallery/`.
- **TODO:** в будущем — отрисовать индивидуальные fal.ai-рендеры под каждую модель (особенно для крупных УИЧ-25 — УИЧ-30В), чтобы убрать визуальное дублирование на product-страницах.

### 7. Раздел «Производство» — литейные участки под ключ
- **URL:** `/proizvodstvo/` — https://uralinduktor.ru/proizvodstvo/
- **Прототип:** [`design/prototypes/proizvodstvo.html`](design/prototypes/proizvodstvo.html)
- **Сервер:** `/var/www/uralinduktor/public/proizvodstvo/index.html`
- **Дата:** 2026-05-25
- **Источник макета:** `Прототипы/прототипы в pdf/Литейное_производство_под_ключ.pdf`
- **Hero-картинка:** `picture/proizvodstvo/proizvodstvo-hero.png`
  (fal.ai · **nano-banana-pro / gpt-image-2**, 16:9, индукционная плавильная печь с потоком расплава, тёплый amber + холодный teal, левая треть тёмная)
- **Workshop-фото (intro + DARK-секция):** `picture/proizvodstvo/proizvodstvo-workshop.png`
  (fal.ai · nano-banana-pro, цех собственного производства УралИндуктор в Миассе со сборкой корпусов индукционного оборудования)
- **Назначение:** ключевая страница позиционирования услуги «литейное производство под ключ». Архитектура из 13 контентных блоков:
  1. **Hero** (full-bleed dark + новое фото) — «Литейное производство под ключ» + 2 CTA
  2. **KPI-стрип** — 4 преимущества (Комплексный подход / Собственное производство / Инженерная поддержка / Работа по РФ и СНГ)
  3. **Intro** (PAGE, 2-колоночный с фото цеха) — «не только поставка, но формирование логики участка»
  4. **4 ситуации → решения** (problems pattern, SUBTLE) — новый участок / модернизация / расширение / объединение
  5. **Leadgen** «Обсудим задачу» (SUBTLE + tech-grid)
  6. **6 результатов для предприятия** (results pattern, SUBTLE, grid 3×2) — системность / предсказуемость / снижение нагрузки / понимание экономики / ответственность / сопровождение
  7. **Почему доверяют УралИндуктор** ⭐ (DARK + image overlay, prod-rf, 3 пилона: опыт инженерии · собственное производство · сервис) + 3 бонуса
  8. **Что входит в реализацию** (PAGE, scope-grid 2×7) — 14 пунктов от анализа задачи до модернизации
  9. **Как строится работа над проектом** (timeline, SUBTLE) — 4 шага (погружение / сбор данных / концепция / реализация)
  10. **Что обязательно учитываем** (SUBTLE, considers-grid 2×5) — 10 параметров инженерного фильтра
  11. **Форматы сотрудничества** (PAGE, formats-grid 5 cards) — новый проект / расширение / частичная модернизация / комплексное сопровождение / этапная реализация
  12. **FAQ** (5 вопросов от ведущего инженера) — без ТЗ / поэтапно / шире поставки / сервис / действующее производство
  13. **Best-offer + контакты** — единая карточка
- **Кастомные стили (новые классы):** `.intro-prod` / `.intro-prod__grid` / `.intro-prod__media`, `.results` / `.result-card`, `.scope` / `.scope-item`, `.considers` / `.consider-item`, `.formats` / `.format-card`. Добавлены в `<style>` блок прототипа.
- **Меню:** обновлены партиалы `_partials/header.html` и `_partials/drawer.html` — «Производство» теперь ведёт на `/proizvodstvo/` (раньше `#`). Sync применён ко всем 13 прототипам.
- **В меню:** top-level пункт «Производство» (4-й пункт). На этой странице — `is-active`.
- **Открытые вопросы:** ещё нет подстраниц «Производство» (структура из футера: проектирование, подбор-комплектация, модернизация, переоснащение дробемётов, монтаж-шефмонтаж, пусконаладка, обучение, технический аудит, диагностика и ремонт) — `/proizvodstvo/` сейчас является финальной страницей раздела.

### 5.1. Категория «Оборудование ЛГМ»
- **URL:** `/products/oborudovanie-lgm/` — https://uralinduktor.ru/products/oborudovanie-lgm/
- **Прототип:** `design/prototypes/category-lgm.html`
- **Сервер:** `/var/www/uralinduktor/public/products/oborudovanie-lgm/index.html`
- **Дата:** 2026-05-24
- **Hero-картинка:** `picture/products/oborudovanie-lgm/lgm-hero-realistic.png`
  (fal.ai · **gpt-image-2**, 16:9, оператор с пенопластовой моделью двигателя
  в цеху, тёплый amber + teal-блики; левая треть тёмная под текст)
- **Каталог-картинки:** 12 шт. в `picture/products/oborudovanie-lgm/products/`
  → продакшн `/img/lgm-products/01..12-*.png` (fal.ai · **gpt-image-2-edit**
  с референсами с источника, сохранён зелёный бренд и логотип «УРАЛ ИНДУКТОР»)
- **Назначение:** ключевая страница позиционирования продуктового направления
  ЛГМ (литьё по газифицируемым моделям) — клон LVM-шаблона с адаптированным
  контентом под Lost-Foam Casting. Архитектура из 10 контентных блоков:
  1. **Hero** (full-bleed dark + новое фото, `Ra 6-12` / `−40% мехобработки`)
  2. **KPI-стрип** (Ra 6–12 / −40 % мехобработки / 12 узлов / 4–8 мес)
  3. **4 проблемы ЛГМ → решения** (SUBTLE, benefit-cards с метриками:
     `Ra 6–12 поверхность` · `100% уплотнение` · `−50% брак моделей` · `−40% мехобработка`)
  4. **Leadgen** (SUBTLE, форма «Расчёт под мой проект ЛГМ»)
  5. **8 ключевых узлов линии ЛГМ** (SUBTLE, grid 4×2 с иконками:
     предвспениватель · склад дозревания · пресс-автомат · ЧПУ-резка · красомешалка
     · 3D-вибростол · вакуумная опока · паровой генератор)
  6. **Производство в РФ** ⭐ (DARK, общий нарратив + 3 пилона)
  7. **Экономика ЛГМ** (PAGE, таблица «песчаное литьё vs ЛГМ» на 500 т/год,
     −40 % себестоимости, ROI 2–3 года)
  8. **План — 4 шага** (SUBTLE, 4–8 мес от заявки до первой отливки)
  9. **Каталог 12 позиций** (PAGE, реальные фото оборудования)
  10. **FAQ** (PAGE, 7 ЛГМ-вопросов: сплавы, размеры, пенопласт-поставщики, лизинг)
  11. **Best-offer + контакты** (SUBTLE, единая карточка)
- **Источник контента:** https://uralinduktor.ru/products/oborudovanie-lgm/
  (короткий intro + 12 продуктовых позиций; remaining content
  адаптирован из доменных знаний Lost-Foam Casting)
- **В меню:** «Каталог → Технологии → ЛГМ» — активировано во всех 6 прототипах
  (index, catalog, category, category-lvm, category-lgm, product).

### 8. Услуга «Пусконаладка»
- **URL:** `/uslugi/puskonaladka/` — https://uralinduktor.ru/uslugi/puskonaladka/
- **Прототип:** `design/prototypes/usluga-puskonaladka.html`
- **Сервер:** `/var/www/uralinduktor/public/uslugi/puskonaladka/index.html`
- **Источник макета:** `Прототипы/прототипы в pdf/Пусконаладка.pdf`
- **Hero-картинка:** `picture/uslugi/puskonaladka/puskonaladka-hero-realistic.png`
  (fal.ai · **gpt-image-2**, 16:9, инженер с планшетом конфигурирует
  индукционную печь; тёплый amber + teal HMI-блики; левая треть тёмная под текст)
- **Назначение:** ключевая страница услуги «Пусконаладка промышленного
  оборудования» — первая в&nbsp;линейке услуг. Архитектура из&nbsp;12 блоков:
  1. **Hero** (full-bleed dark + новое фото)
  2. **KPI-стрип** (Готовность / Настройка / Снижение / Связка)
  3. **«Что такое пусконаладка»** — текст-секция с выделенным блоком «Без пусконаладки»
  4. **«В каких ситуациях нужна»** — 4 карточки (новый узел, модернизация,
     сложный участок, переоснащение)
  5. **«Что получает предприятие»** — 6 benefit-cards (рабочий режим, настройка,
     проверка, снижение простоев, обучение, стабильность)
  6. **Leadgen** — форма «Расчёт пусконаладки»
  7. **«Что входит в пусконаладку»** — нумерованный список 12 пунктов (grid 3×4)
  8. **Timeline** — 4 этапа работы (готовность → проверка → настройка → запуск)
  9. **«Что учитывается»** — нумерованный список 12 пунктов (grid 3×4, alt-фон)
  10. **«Почему доверяют УралИндуктор»** ⭐ (DARK + image overlay, 4 пилона:
      связка задачи / опыт металлургии / единая логика этапов / сопровождение)
  11. **«В каком формате может выполняться»** — 5 карточек (новое оборудование /
      участок / после модернизации / под ключ / после переоснащения)
  12. **FAQ** — 5 вопросов с ответами от ведущего инженера
  13. **Best-offer + контакты** (единая карточка)
- **Источник контента:** PDF-прототип «Пусконаладка»
- **В меню:** «Услуги → Полный цикл запуска → Пусконаладка» (активирована в&nbsp;партиале
  `_partials/header.html`, разнесена по&nbsp;всем 13 прототипам через `sync-partials.py`)
- **В футере:** активирована ссылка в&nbsp;списке «Услуги»

### 9. Услуга «Технический аудит»
- **URL:** `/uslugi/tehnicheskij-audit/` — https://uralinduktor.ru/uslugi/tehnicheskij-audit/
- **Прототип:** `design/prototypes/usluga-tehnicheskij-audit.html`
- **Сервер:** `/var/www/uralinduktor/public/uslugi/tehnicheskij-audit/index.html`
- **Источник макета:** `Прототипы/прототипы в pdf/Технический_аудит.pdf`
- **Hero-картинка:** `picture/uslugi/tehnicheskij-audit/audit-hero-blueprint.png`
  (fal.ai · **gpt-image-2-edit**, blueprint-стиль на основе референса
  дробемётной установки для очистки швеллера/двутавра/сорта)
- **Назначение:** страница услуги «Технический аудит оборудования и&nbsp;производственных
  участков» — 13-блочная архитектура:
  1. **Hero** (full-bleed dark + blueprint-изображение)
  2. **KPI-стрип** (Основа / Слабые / Участки / Связка)
  3. **«Что такое аудит»** — текст + warn-блок «Без аудита&nbsp;— действия наугад»
  4. **«В каких ситуациях нужен»** — 4 карточки (нестабильная работа,
     модернизация, рост затрат, подготовка к&nbsp;ремонту)
  5. **«Что получает предприятие»** — 6 benefit-cards (картина состояния,
     причины, риски, решения, контроль, &minus;ошибки)
  6. **Leadgen** — форма «Заказать технический аудит»
  7. **«Что входит в&nbsp;аудит»** — нумерованный список 12 пунктов (grid 3×4)
  8. **Timeline** — 4 этапа (заявка → выезд → анализ → отчёт)
  9. **«Что учитывается»** — список 12 пунктов (grid 3×4, alt-фон)
  10. **«Почему аудит доверяют УралИндуктор»** (DARK + 4 пилона: контекст,
      металлургия, реализация решений, сопровождение)
  11. **Форматы аудита** — 5 карточек (узел / линия / участок / экспресс / расширенный)
  12. **FAQ** — 5 вопросов
  13. **Best-offer + контакты**
- **Источник контента:** PDF-прототип «Технический аудит»
- **В меню:** заменил пункт «Индукционных нагревателей / Ремонт и&nbsp;замена компонентов»
  на «Технический аудит / Оценка состояния и&nbsp;слабых мест оборудования» в&nbsp;партиале
  `_partials/header.html` + server-side patch разнёс изменение по&nbsp;361 странице,
  футер обновлён на&nbsp;366 страницах.
- **В футере:** активирована ссылка в&nbsp;списке «Услуги»

### 22. Политика обработки персональных данных
- **URL:** `/policy/` — https://uralinduktor.ru/policy/
- **Прототип:** `astro/src/raw-pages/policy/` (body.html + meta.json)
- **Сервер:** `/var/www/uralinduktor-astro/policy/index.html`
- **Назначение:** юридическая страница — Политика по&nbsp;152-ФЗ.
  17&nbsp;разделов (общие положения, основные понятия, сведения об&nbsp;Операторе,
  правовые основания, цели, категории субъектов, принципы, порядок и&nbsp;условия,
  сроки, трансграничная передача, согласие, cookie и&nbsp;веб-аналитика,
  безопасность, инциденты, права субъекта, порядок обращений, заключительные).
  Реквизиты заполнены: ООО&nbsp;«МТПК», ОГРН&nbsp;1137415000315, ИНН&nbsp;7415079152,
  адрес 456318, Челябинская обл., Миасс, ул.&nbsp;Уральских Добровольцев, 1в,
  info@uralinduktor.ru, +7&nbsp;(351) 211-65-97.
- **Шаблон:** простой — `legal-hero` (breadcrumb + h1 + дата редакции) +
  `legal-body` (типографика, h2, p, ul). Контейнер 880&nbsp;px, отзывчивая
  типографика clamp() для&nbsp;мобильных.
- **В футере:** ссылка `/policy/` — «Политика конфиденциальности».
- **Дата:** 2026-06-03.

### 23. Согласие на обработку персональных данных
- **URL:** `/soglasie/` — https://uralinduktor.ru/soglasie/
- **Тип:** T12 — юридическая страница (см. [`docs/page-types/T12-legal.md`](docs/page-types/T12-legal.md))
- **Прототип:** `astro/src/raw-pages/soglasie/` (body.html + meta.json)
- **Сервер:** `/var/www/uralinduktor-astro/soglasie/index.html`
- **Назначение:** отдельное согласие по&nbsp;ч.4 ст.9 152-ФЗ
  (с&nbsp;учётом требований с&nbsp;01.09.2025). 9&nbsp;разделов: субъект, оператор,
  цели, перечень данных, способы обработки, cookie, передача третьим лицам,
  срок и&nbsp;отзыв, подтверждение.
- **Реквизиты:** ООО «МТПК» (бренд «УралИндуктор»), ОГРН 1137415000315, ИНН 7415079152,
  456318, Челябинская обл., Миасс, ул. Уральских Добровольцев, 1в.
- **Шаблон:** тот&nbsp;же что&nbsp;`/policy/` — `legal-hero` + `legal-body` + `.legal-container 880px`.
- **В футере:** ссылка `/soglasie/` — «Согласие на&nbsp;обработку персональных данных».
- **Дата:** 2026-06-03.

### 24. Корень каталога — общий индекс
- **URL:** `/products/` — https://uralinduktor.ru/products/
- **Тип:** T02 — корень каталога (см. [`docs/page-types/T02-catalog-root.md`](docs/page-types/T02-catalog-root.md))
- **Прототип:** `astro/src/raw-pages/products/` (body.html + meta.json)
- **Сервер:** `/var/www/uralinduktor-astro/products/index.html`
- **Назначение:** «Полный каталог» — 12 разделов каталога с категориями.
  Каждый раздел&nbsp;— блок `<section class="cat-index">` с&nbsp;h2 + сетка&nbsp;`.scard`.
  Сетка `.scard` 3 колонки desktop, 2 tablet, 1 mobile. Все 18 категорий L3 +
  типы L4 для разделов без L3 (нагреватели 1 промо-карточка, муфельные 13 типов,
  вакуумные 8 типов, запчасти 4 типа, ЛВМ/ЛГМ/ХТС/ПГС&nbsp;— 1 промо-карточка).
- **Картинки:** используются те же `card-*.png/jpg`, что в `teaser-card` хабов
  разделов (T03a/T03b)&nbsp;— ОДИН источник правды по карточкам.
- **CSS:** `body { background: #FFFFFF }` принудительно, цвета текста с&nbsp;`!important`
  (фикс «тёмный фон» 03.06.2026, см. историю правок).
- **Дата:** 2026-06-03.

---

## История ключевых правок (после 30.05.2026)

### Тёмная плашка фильтра на категориях
- **Дата:** 2026-06-03
- **Где:** override `DARK FILTER OVERRIDE` в `inline_styles[1]` страниц
  L3 категорий. Сейчас активирован на `/products/induktsionnye-plavilnye-pechi/po-stali/`.
- **Что:** `.catalog-filter` теперь тёмная (`#1A1D20`), триггеры со светлым текстом,
  hover/open — teal-подсветка. Выпадающая панель остаётся светлой.
- **План:** раскатить override на все L3 категории, использующие фильтр (≈ все
  подкатегории плавильных печей, дробемётов, охлаждения, ковшей).

### Массовый фикс заглушек-форм (25 шт. на 13 страницах)
- **Дата:** 2026-06-03
- **Что было:** 25 форм без `class="js-lead-form"` + `onsubmit="alert('демо')"`.
  Не подключались к `forms.js`, не отправляли заявку в `send.php`. Тихая потеря лидов.
- **Где:** главная (1), 6 страниц `/uslugi/*` (по 2), 4 продуктовых хаба ЛВМ/ЛГМ/ПГС/ХТС
  (по 2), `/proizvodstvo/` (2), `/o-company/` (1).
- **Как чинено:** Python-скрипт `/tmp/fix_forms.py` — добавил `js-lead-form`,
  4 hidden поля (`company` honeypot, `form_ts`, `source`, `roistat_visit`),
  `name=` атрибуты, `required` на телефон/имя, ссылку на `/policy/` для согласия.
- **Проверено:** реальный лид «Клод Финал» прошёл в `/var/www/uralinduktor/logs/leads.log`.

### Hero `/proizvodstvo/` — v2
- **Дата:** 2026-06-03
- **Файл:** `proizvodstvo-hero-v2.png` + WebP. 16:9, фотореалистичный цех:
  2 индукционные печи с тиристорными шкафами + намёки на дробемёты по бокам.
  Сгенерирован nano-banana-pro-edit с фоторефом тиристорной печи.
- **Overlay** усилен (5-ступенчатый градиент: 0.94 → 0.20) для читаемости текста hero.
- **Cache-bust:** `?v=1`.

### Подкатегория градирен — v4 продукт
- **Дата:** 2026-06-03
- **Файл:** `card-gradirni-v4.png` — две части (верхний модуль + нижний с насосом и трубами).
  Использован на 13 продуктовых страницах под `sistemy-ohlazhdeniya/gradirni/`.
- **Hero v1:** `hero-gradirni-v1.png` сгенерирован, но **не активирован** —
  использует прежний hero. Решение об активации отложено.

---

## В разработке (🟡)

### 6. Категория «Оборудование ХТС»
- **URL:** `/products/linii-dlya-holodnotverdeyushhih-smesej-hts/` (планируется https://uralinduktor.ru/products/linii-dlya-holodnotverdeyushhih-smesej-hts/)
- **Прототип:** `design/prototypes/category-hts.html`
- **Дата:** 2026-05-24
- **Hero-картинка:** `picture/products/linii-dlya-holodnotverdeyushhih-smesej-hts/hts-hero-realistic.png`
  (сгенерирована через fal.ai · модель **gpt-image-2**, 16:9, реалистичный
  кадр линии формовки ХТС с тёплым amber + холодным teal светом)
- **Назначение:** ключевая страница позиционирования продуктового направления ХТС
  (холодно-твердеющие смеси). Архитектура повторяет [`category-lvm.html`](design/prototypes/category-lvm.html)
  из 11 контентных блоков + контакты:
  1. **Hero** (full-bleed dark + новое фото) — «Оборудование для форм и стержней на ХТС»
  2. **KPI-стрип** (до&nbsp;95&nbsp;% / 3–40 т/ч / 7 узлов / 4–8 мес)
  3. **Что такое ХТС-процесс** (PAGE, 2-колоночный intro: смысловой текст с боевого
     сайта + 4 ключевых тезиса с иконками — любая конфигурация, замкнутый цикл,
     высокая точность, гибкость)
  4. **4 проблемы ХТС → решения** (SUBTLE, 2×2 карточки):
     регенерация песка / дозирование смолы / уплотнение опоки / пылеулавливание
  5. **Лидген** (форма «расчёт под мой проект»)
  6. **7 узлов оборудования** (SUBTLE, grid с иконками): смеситель / вибростол /
     виброоттирка / шкаф охлаждения / линия регенерации / пневмотранспорт /
     пылеуловитель
  7. **Производство в РФ** ⭐ (DARK + image overlay: Проектируем → Изготавливаем →
     Монтируем и обслуживаем + 3 бонуса: гарантия 18 мес, ЗИП в Миассе,
     документы для аудита)
  8. **Экономика регенерации** (PAGE, таблица сравнения для программы
     1 000 т/год + большая цифра 95% + ROI 1–2 года)
  9. **План — 4 шага** (SUBTLE, timeline 4–8 мес)
  10. **Линейка оборудования** (PAGE, 10 карточек продуктовых семейств с
      SVG-плейсхолдерами и model-кодами: УИ-ЛР, УИШС, УИВС, УИВР, УИШО, УИПТ +
      пылеуловитель + комплекс под ключ)
  11. **FAQ** (PAGE, 8 вопросов в `<details>` accordion — включая «что такое ХТС-процесс»)
  12. Контакты + best-offer
- **Источник контента:** https://uralinduktor.ru/products/linii-dlya-holodnotverdeyushhih-smesej-hts-2/
  (включая 7 подкатегорий с моделями УИ-ЛР, УИШС, УИВС, УИВР, УИШО, УИПТ)
- **В меню:** «Каталог → Производственные линии → ХТС» (мегаменю обновлён,
  ссылка ведёт на `/products/linii-dlya-holodnotverdeyushhih-smesej-hts/`).
- **Открытые вопросы:** сгенерировать 10 отдельных продуктовых фото
  (сейчас SVG-плейсхолдеры с model-бейджами), переключить мегаменю на других
  страницах на актуальный URL.

### Контакты
- **URL:** `/kontakty/` (raw-page: `astro/src/raw-pages/kontakty/`)
- **Дата:** 2026-08-28
- **Назначение:** единая страница контактов. Блоки: hero → способы связи
  (телефон, email, Telegram, MAX — карточки) → **Команда** (перенесена со страницы
  «О компании»: дирекция/отдел продаж/инженерный/бухгалтерия) → **Отзывы** (живой
  виджет Яндекс.Карт, организация `94364878698` / `mtpk_uralinduktor`) → best-offer CTA.
- **В меню:** top-level «Контакты» (после «О компании»); есть в шапке, drawer и футере.
  `activeNav = 'kontakty'` в `[...slug].astro`.
- **Связано:** из «О компании» убрана секция `<section class="team">` (+ её инлайн-стили).

### 9. О компании
- **URL:** `/o-company/`
- **Прототип:** [`design/prototypes/o-company`](design/prototypes/o-company)
- **Источник макета:** `Прототипы/прототипы в pdf/О_компании.pdf`
- **Дата:** 2026-05-25 (+ блок «Команда» — 2026-05-30)
- **Hero-картинка:** `picture/o-company/office-hero.jpg` (реальное фото офиса, IMG_1714, конвертировано из HEIC через `sips -Z 2400`)
- **Дополнительные фото:**
  - `picture/o-company/company-main.jpg` — основное фото компании (уи3.jpg)
  - `picture/o-company/company-secondary.jpg` — дополнительное фото (уи2.jpg, используется в тёмной story-секции)
  - **Команда (12 фото):** `astro/public/img/team/*.png` — портреты сотрудников
    (nikolay, anton, polina, raushania, olesya, anna, vladimir, dmitry-d, dmitry-p, julia, ekaterina, andrey).
    Источник — слепок боевого сайта `site/contact/images/`. Андрей (тех. директор)
    в разметке не используется — фото оставлено в репо на случай возврата.
- **Назначение:** страница «О компании» — позиционирование УралИндуктора как российского производителя и поставщика промышленного оборудования. Архитектура повторяет [`category-lvm.html`](design/prototypes/category-lvm.html) (header/footer-партиалы, базовый CSS), но содержит уникальные блоки:
  1. **Hero** (full-bleed dark + фото офиса) — «УралИндуктор — производитель и поставщик» + 2 CTA (Обсудить проект / Подобрать оборудование)
  2. **KPI-стрип** (14 лет / 100% собственное / 18 мес гарантии / РФ + СНГ)
  3. **6 направлений** (SUBTLE, grid 3×2): Производство оборудования / Литейные под ключ / Поставка / Инжиниринг / Запчасти / Сервис
  4. **Производственная и инженерная база** (PAGE) — 2 фото в hero-стрипе + 4 карточки (собственное производство / инженерный центр / склад / сервисная служба)
  5. **«14 лет работы»** (DARK + фото company-secondary справа) — story + пиллы регионов (Урал, Сибирь, Центральная Россия, Юг, Казахстан, Беларусь, Узбекистан, СНГ)
  6. **«Как мы выстраиваем работу»** (SUBTLE, 4 карточки): Техническая экспертиза / Выезд / Ответственность / Единый контакт
  7. **Стандарты + инженерная экспертиза** (PAGE) — двухколоночный intro + жёлтая callout-«ИНЖЕНЕРНАЯ ЭКСПЕРТИЗА» с двумя списками
  8. **Лидген** «Обсудим вашу задачу и предложим рабочее решение»
  9. **Контакты + способы связи + карта** (best-offer паттерн)
- **Кастомные стили (новые классы):** `.cat-hero--about`, `.directions__grid` / `.dir-card`, `.base__media` / `.base-card`, `.story` / `.story-pill`, `.approach__grid` / `.approach-card`, `.partners-row` / `.eng-note`, `.about-head`. Добавлены в `<style>` блок прототипа.
- **В меню:** top-level пункт «О компании» (последний). Активный state в шапке сейчас по-прежнему на «Каталог» (общий партиал — известная особенность, лечится отдельно).
- **Открытые вопросы:**
  - Заменить map-плейсхолдер на реальный Yandex Maps iframe (как на главной).
  - Решить активный state «О компании» в шапке (через JS-помечатель страницы или per-page override).
- **Блок «Команда» (добавлен 2026-05-30):** секция `<section class="team">` между
  «Как мы выстраиваем работу» и «География работы». 4 группы карточек
  `.team-card` (96×96 круг-фото, должность mono-капшен, имя, email):
  - Дирекция (2): Николай (директор) · Антон (зам. директора)
  - Отдел продаж (5): Михаил (нач.), Полина, Раушания, Олеся, Анна
  - Инженерный отдел (3): Владимир, Дмитрий (dmitry@), Дмитрий (pdv@)
  - Бухгалтерия (2): Юлия (главбух), Екатерина
  - Стили описаны в [`style.md` §20](style.md). Источник данных — слепок
    `site/contact/content.md`.

### 10. Наличие на складе
- **URL:** `/nalichie/`
- **Тип страницы:** raw-page (`astro/src/raw-pages/nalichie/{body.html,meta.json}`),
  стили из общего CSS-блоба `meta.json` — **никаких per-page styles**.
- **Источник макета:** `Прототипы/прототипы в pdf/Оборудование_в_наличии.pdf`
- **Дата:** 2026-05-30
- **Hero-картинка:** `astro/public/img/nalichie/nalichie-hero.jpg`
  (16:9, 1344×768, ~360 КБ, сгенерирована через fal-ai/nano-banana —
  склад в Миассе с печами, шкафами, паллетами).
- **Структура секций** (все классы — родные):
  1. **`.cat-hero`** — фон-картинка склада + overlay + breadcrumb + eyebrow + H1 + 2 CTA
  2. **`.stats`** — 4 KPI (5 направлений · от 1 дня отгрузка · РФ+СНГ · 18 мес гарантия)
  3. **`.catalog-list#stock-list`** — **«Сейчас на складе»**: фильтр по категориям
     `.case__filters` (генерится JS из `stock.json`) + сетка `.pcard-grid`,
     карточки рендерит `/js/stock-list.js`. Empty-state — если позиций нет.
  4. **`.full-cycle`** — 4 шага «Как уточнить наличие и получить» (cycle-step)
  5. **`.turnkey`** (тёмный) — «Нет в наличии? Поставка под заказ + Китай 45–90 дней»
  6. **`<!--C:leadgen-->`** — общий лидген-блок
  7. **`<!--C:best-offer-->`** — контакты + финальная форма
- **Подсистема «Наличие на складе»:**
  - Источник правды: `astro/data/stock.config.json` (только URL'ы)
  - Резолвер: `astro/scripts/build-stock.mjs` (через `npm run stock` или
    автоматически как `prebuild`)
  - Автоген для рантайма: `astro/public/data/stock.json`
  - Клиентский рендер: `/js/stock-list.js`
  - Бейдж в каталоге: `/js/stock-badges.js` (тот же `stock.json`)
  - Стили: `/css/stock.css` (бейдж, мета-поля, обёртка фильтра)
  - **Полная документация:** [`docs/stock-system.md`](docs/stock-system.md)
- **В меню:** top-level пункт «Наличие» (заменил «Производство» — 2026-05-29).
- **Открытые вопросы:**
  - Добавить «склад в Китае» как опц. отдельный раздел (по мере роста позиций).
  - Уведомления оператору при истечении срока «акт. наличия» (TODO для дальнейшего).

### 8. Проекты / Кейсы
- **URL:** `/proekty/`
- **Прототип:** `design/prototypes/projects.html`
- **Источник макета:** `Прототипы/прототипы в pdf/Проекты__Кейсы.pdf`
- **Источник данных:** https://uralinduktor.ru/vypolnennye-proekty/ (~170 проектов
  в `site/equipment/`); в прототипе показано 8 примеров (плавильные печи,
  дробемёт, градирня, МНЛЗ, нагреватель, линия ЛВМ).
- **Назначение:** хаб реализованных проектов. Тёмный hero c 4-чек-листом
  (Поставки / Запуски / Модернизация / Под ключ) и двойным CTA;
  filter-табы по 6 направлениям (Все / Индукционное / Дробемётное /
  Градирни и охлаждение / Литейные под ключ / Модернизация); featured-кейс
  (печь УИ для чугуна, Челябинская обл.) с meta-пиллами Тип/Отрасль/Регион,
  блоками Задача/Результат и галереей 5 thumb; карусель крайних 8 проектов;
  3 видеообзора; стандартный why-us (6 преимуществ + 7 отраслей); лидген
  «Обсудим вашу задачу» с выбором канала связи (По телефону / MAX / Telegram);
  контакты с картой Yandex.
- **В меню:** top-level пункт «Проекты» (активный).
- **Открытые вопросы:** стратегический выбор по 170 проектам (`/equipment/`) —
  гибрид: 20-30 значимых отдельные страницы + остальные на агрегатор-таб.

---

## Шапка и меню (общая на всех страницах)

### Каталог (мегаменю — 3 колонки, без feature)
- **Плавильное оборудование:** Индукционные плавильные печи (✅ → `/products/induktsionnye-plavilnye-pechi/`) /
  Индукционные нагреватели (⬜) / Дробемётные установки (✅ → `/products/drobemetnoe-oborudovanie/`) / Системы охлаждения (⬜)
- **Производственные линии:** ХТС (✅ → `/products/linii-dlya-holodnotverdeyushhih-smesej-hts/`) / ЛВМ (✅) / ЛГМ (⬜) / ДПС (⬜)
- **Доп оборудование:** Муфельные печи (⬜) / Запчасти на оборудование (⬜) /
  Вакуумное оборудование (⬜) / Лабораторное оборудование (⬜)

### Услуги (мегаменю — feature + 2 колонки)
- **Feature:** «Проектирование литейного производства с нуля под ключ»
  (картинка `picture/shared/photo-drobemet.jpg`)
- **Полный цикл запуска:** Пусконаладка (⬜) / Монтаж и шефмонтаж (⬜) /
  Обучение персонала (⬜)
- **Аудит, ремонт и модернизация:** Плавильных печей (⬜) /
  Дробемётных установок (⬜) / Индукционных нагревателей (⬜)

### Остальные пункты
- **Производство** (⬜) / **Проекты** (⬜) / **О компании** (⬜) — заглушки.

### Мобильное меню (drawer)
- Hamburger в шапке (≤1024px), drawer с 5 top-level пунктами
  (Каталог → /products/induktsionnoe-oborudovanie/, Услуги/Производство/Проекты/О компании)
- Контакты внизу drawer: телефон, email.

### Подвал
- Включает дублирующиеся ссылки на каталог, услуги, производство, компанию.
- На текущий момент содержит **устаревшие пункты** (Технический аудит,
  Монтаж и шефмонтаж и т.д.) — синхронизация с новым меню не сделана.

---

## Правила добавления новых страниц

1. **Перед созданием** новой страницы — обсудить с пользователем:
   - В какой раздел вкладывается (Каталог/Услуги/...)?
   - Как привязана к меню (мегаменю / подменю / только в подвале)?
   - URL-схема (slug на русском или транслите)?
2. **После создания** прототипа:
   - Внести запись в этот файл (`structura.md`) — URL, прототип, назначение, статус 🟡.
   - При деплое — изменить статус на ✅.
3. **Картинки страницы** складывать в `picture/<путь-страницы>/` по правилам
   `picture.md`.

---

*Последнее обновление: 2026-05-24 — добавлен прототип категории «Оборудование ХТС»
(`/products/linii-dlya-holodnotverdeyushhih-smesej-hts/`, [`category-hts.html`](design/prototypes/category-hts.html)),
hero-фото `picture/products/linii-dlya-holodnotverdeyushhih-smesej-hts/hts-hero-realistic.png`, обновлён мегаменю.*
