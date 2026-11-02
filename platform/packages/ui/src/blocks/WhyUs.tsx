// Блок «Почему мы» (маркеры why-us, why-us-12, why-us-6) — общая секция сайта.
// Разметка совпадает с прежней вёрсткой сайта до пробела: пробелы между тегами влияют на отрисовку inline-элементов.
// months — срок гарантии: 18 по умолчанию, 12 и 6 — в разделах с другой гарантией.
export function WhyUs({ months = 18 }: { months?: number }) {
  return (
    <>
    <section className="why-us" aria-label="Почему выбирают УралИндуктор">
      {" "}
      <div className="why-us__hero">
        {" "}
        <div className="container">
          {" "}
          <div className="why-us__head">
            {" "}
            <div className="why-us__eyebrow">
              Почему мы
            </div>
            {" "}
            <h2 className="why-us__title">
              {"Почему выбирают "}
              <em>
                УралИндуктор
              </em>
            </h2>
            {" "}
            <p className="why-us__lead">
              {"Производитель полного инженерного цикла: от\u00A0подбора оборудования до\u00A0запуска и\u00A0сервиса — в\u00A0рамках одной компании."}
            </p>
            {" "}
          </div>
          {" "}
          <div className="why-us__tags">
            {" "}
            <div className="why-us__tags-label">
              Кому подходит
            </div>
            {" "}
            <ul className="why-us__tags-list">
              {" "}
              <li>
                Металлургические предприятия
              </li>
              {" "}
              <li>
                Литейные производства
              </li>
              {" "}
              <li>
                Машиностроение
              </li>
              {" "}
              <li>
                Производства алюминия
              </li>
              {" "}
              <li>
                Вторичная металлургия
              </li>
              {" "}
              <li>
                Ремонтно-механические производства
              </li>
              {" "}
              <li>
                {"Термическая и\u00A0плавильная обработка металлов"}
              </li>
              {" "}
            </ul>
            {" "}
          </div>
          {" "}
        </div>
        {" "}
        <div className="why-us__image" role="img" aria-label="Инженер УралИндуктор в производственном цеху" />
        {" "}
      </div>
      {" "}
      <div className="why-us__cards-band">
        {" "}
        <div className="container">
          {" "}
          <div className="why-us__cards">
            {" "}
            <article className="why-us-card">
              {" "}
              <div className="why-us-card__num">
                01
              </div>
              {" "}
              <div className="why-us-card__icon">
                {" "}
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 40V20l11-5v5l11-5v8l11-3v20H6z" />
                  <rect x="14" y="6" width="4" height="11" />
                  <path d="M14 3l4-1" />
                  <path d="M11 30v6M17 30v6M23 30v6M29 30v6M35 30v6" />
                </svg>
                {" "}
              </div>
              {" "}
              <h3 className="why-us-card__title">
                {"Производитель по\u00A0ключевым направлениям"}
              </h3>
              {" "}
              <p className="why-us-card__text">
                {"Сами производим индукционные плавильные печи и\u00A0нагреватели, дробемётное оборудование, системы охлаждения и\u00A0сталеразливочные ковши — отвечаем за\u00A0всё как\u00A0производитель."}
              </p>
              {" "}
            </article>
            {" "}
            <article className="why-us-card">
              {" "}
              <div className="why-us-card__num">
                02
              </div>
              {" "}
              <div className="why-us-card__icon">
                {" "}
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M42 24a18 18 0 0 0-31-12" />
                  <path d="M11 6v6h6" />
                  <path d="M6 24a18 18 0 0 0 31 12" />
                  <path d="M37 42v-6h-6" />
                  <circle cx="24" cy="24" r="3" />
                </svg>
                {" "}
              </div>
              {" "}
              <h3 className="why-us-card__title">
                Полный инженерный цикл
              </h3>
              {" "}
              <p className="why-us-card__text">
                {"Подбор, проектирование, поставка, монтаж, пусконаладка, обучение и\u00A0сервис — в\u00A0рамках одной компании."}
              </p>
              {" "}
            </article>
            {" "}
            <article className="why-us-card">
              {" "}
              <div className="why-us-card__num">
                03
              </div>
              {" "}
              <div className="why-us-card__icon">
                {" "}
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="6" width="16" height="16" />
                  <rect x="26" y="6" width="16" height="11" />
                  <rect x="6" y="26" width="11" height="16" />
                  <rect x="21" y="21" width="21" height="21" />
                </svg>
                {" "}
              </div>
              {" "}
              <h3 className="why-us-card__title">
                Широкий продуктовый портфель
              </h3>
              {" "}
              <p className="why-us-card__text">
                {"Закрываем большинство задач металлургического и\u00A0литейного производства — от\u00A0отдельной печи до\u00A0участка под\u00A0ключ."}
              </p>
              {" "}
            </article>
            {" "}
            <article className="why-us-card">
              {" "}
              <div className="why-us-card__num">
                04
              </div>
              {" "}
              <div className="why-us-card__icon">
                {" "}
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="24" cy="19" r="12" />
                  <path d="M17 28l-3 16 10-6 10 6-3-16" />
                  <path d="M19 19l4 4 7-7" strokeWidth="2.5" />
                </svg>
                {" "}
              </div>
              {" "}
              <h3 className="why-us-card__title">
                Реальный технический опыт
              </h3>
              {" "}
              <p className="why-us-card__text">
                {"Работаем с\u00A02014\u00A0года. Реализованные проекты разного уровня сложности, инженеры с\u00A0практическим опытом запусков."}
              </p>
              {" "}
            </article>
            {" "}
            <article className="why-us-card">
              {" "}
              <div className="why-us-card__num">
                05
              </div>
              {" "}
              <div className="why-us-card__icon">
                {" "}
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12h26v22H4z" />
                  <path d="M30 18h8l6 6v10h-9" />
                  <circle cx="12" cy="36" r="3.5" />
                  <circle cx="34" cy="36" r="3.5" />
                  <path d="M15 36h16" />
                </svg>
                {" "}
              </div>
              {" "}
              <h3 className="why-us-card__title">
                {"Оперативность по\u00A0складским позициям"}
              </h3>
              {" "}
              <p className="why-us-card__text">
                {"Часть оборудования доступна со\u00A0склада — сокращаем сроки реализации при\u00A0срочных задачах."}
              </p>
              {" "}
            </article>
            {" "}
            <article className="why-us-card">
              {" "}
              <div className="why-us-card__num">
                06
              </div>
              {" "}
              <div className="why-us-card__icon">
                {" "}
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M24 5l17 6v12c0 10-7 18-17 20-10-2-17-10-17-20V11l17-6z" />
                  <path d="M16 24l6 6 11-11" strokeWidth="2.5" />
                </svg>
                {" "}
              </div>
              {" "}
              <h3 className="why-us-card__title">
                {"Гарантия и\u00A0сопровождение"}
              </h3>
              {" "}
              <p className="why-us-card__text">
                {`Гарантия ${months}\u00A0месяцев на\u00A0собственное производство. Постгарантийное обслуживание, запчасти и\u00A0сервис — на\u00A0постоянной основе.`}
              </p>
              {" "}
            </article>
            {" "}
          </div>
          {" "}
        </div>
        {" "}
      </div>
      {" "}
    </section>
    </>
  );
}
