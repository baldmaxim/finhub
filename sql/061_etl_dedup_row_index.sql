-- 061: Добавляем row_index к ключу дедупликации etl_1c_entries.
--
-- Контекст: при сверке р/с 40702810238000081762 с карточкой сч.51 за период
-- 01.01.2022 — 27.04.2026 обнаружено, что ровно 2 проводки потерялись
-- (в сумме 2 440 425,25 ₽), из-за чего баланс портала превысил 1С на эту
-- величину. Конкретные «потерянные» строки:
--   • 27.11.2024 СП00-016453 — Возврат гарантийного удержания «СУ-10
--     Фундаментстрой» по ДГ ИЛ3-100221, две одинаковые строки по 2 376 544,16 ₽;
--   • 28.11.2024 СП00-016499 — те же реквизиты, две строки по 63 881,09 ₽.
-- В 1С это РЕАЛЬНЫЕ парные проводки (разные ведомости/субсчета гарантийных
-- удержаний), но у них совпадают ВСЕ поля ключа дедупликации (миграция 055):
-- doc_date, amount, counterparty_name, contract_name, debit_account, document,
-- analytics_dt, analytics_kt. Дедупликатор схлопывает их в одну запись.
--
-- Решение: добавить в схему поле row_index INTEGER (порядковый номер появления
-- проводки с одинаковым бизнес-ключом в источнике) и включить его в UNIQUE
-- индекс. Старые записи получают row_index = 0; при повторном импорте те же
-- строки получат те же row_index 0..N и корректно отсеются дубли. Новые
-- импорты со множественными идентичными строками сохранят все копии.

-- 1) Поле row_index. NOT NULL DEFAULT 0 чтобы старые строки не потерялись.
ALTER TABLE etl_1c_entries
  ADD COLUMN IF NOT EXISTS row_index INTEGER NOT NULL DEFAULT 0;

-- 2) Перестраиваем уникальный функциональный индекс с учётом row_index.
DROP INDEX IF EXISTS etl_1c_entries_dedup_idx;

CREATE UNIQUE INDEX IF NOT EXISTS etl_1c_entries_dedup_idx
  ON etl_1c_entries (
    doc_date,
    amount,
    COALESCE(counterparty_name, ''),
    COALESCE(contract_name, ''),
    COALESCE(debit_account, ''),
    COALESCE(document, ''),
    COALESCE(analytics_dt, ''),
    COALESCE(analytics_kt, ''),
    row_index
  );
