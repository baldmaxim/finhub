-- 053: Остатки на начало периода по расчётным счетам
--
-- Проблема: представление bank_account_balances вычисляет остаток как сумму
-- проводок из etl_1c_entries (приходы − расходы ± переводы). В импорте
-- участвуют только операции из карточки сч.51, но «Сальдо на начало» —
-- это НЕ операция, а исходное состояние счёта на дату начала загруженного
-- периода. В результате портал показывает остаток на величину «начального
-- сальдо» меньше, чем в карточке 1С.
--
-- Решение: добавить поля opening_balance и opening_date в bank_accounts
-- и учитывать их в обоих представлениях остатков.

-- 1) Поля начального сальдо
ALTER TABLE bank_accounts
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_date    DATE;

-- 2) Стартовое сальдо для р/с 40702810225644213694 (ВТБ Центральный)
--    из карточки сч.51 ООО «СУ-10» за полный период 01.01.2022 — 22.04.2026:
--    «Сальдо на начало» = 0,00 ₽ на 01.01.2022 (счёт открыт в этот период).
--    Контроль на 22.04.2026: остаток = 2 847 304,19 ₽ Д.
--    Σ Дебет 51 = 22 343 293 540,04 ₽; Σ Кредит 51 = 22 340 446 235,85 ₽.
UPDATE bank_accounts
   SET opening_balance = 0.00,
       opening_date    = DATE '2022-01-01',
       updated_at      = now()
 WHERE account_number  = '40702810225644213694';

-- 3) Пересоздаём представление общего остатка с учётом opening_balance
DROP VIEW IF EXISTS bank_account_balances;

CREATE VIEW bank_account_balances AS
WITH
inflows AS (
  SELECT bank_account_id AS account_id, SUM(amount) AS total
    FROM etl_1c_entries
   WHERE bank_account_id IS NOT NULL
     AND doc_type IN ('receipt', 'debt_correction')
   GROUP BY bank_account_id
),
expenses AS (
  SELECT bank_account_id AS account_id, SUM(amount) AS total
    FROM etl_1c_entries
   WHERE bank_account_id IS NOT NULL
     AND doc_type = 'expense'
   GROUP BY bank_account_id
),
transfers_in AS (
  SELECT e.bank_account_id AS account_id, SUM(e.amount) AS total
    FROM etl_1c_entries e
    JOIN bank_accounts ba ON ba.id = e.bank_account_id
   WHERE e.doc_type = 'internal_transfer'
     AND e.analytics_dt LIKE ba.account_number || '%'
   GROUP BY e.bank_account_id
),
transfers_out AS (
  SELECT e.bank_account_id AS account_id, SUM(e.amount) AS total
    FROM etl_1c_entries e
    JOIN bank_accounts ba ON ba.id = e.bank_account_id
   WHERE e.doc_type = 'internal_transfer'
     AND e.analytics_kt LIKE ba.account_number || '%'
   GROUP BY e.bank_account_id
)
SELECT
  ba.id,
  ba.account_number,
  ba.bank_name,
  ba.bik,
  ba.description,
  ba.is_active,
  ba.opening_balance,
  ba.opening_date,
  COALESCE(i.total, 0)    AS inflows,
  COALESCE(ex.total, 0)   AS expenses,
  COALESCE(ti.total, 0)   AS transfers_in,
  COALESCE(tout.total, 0) AS transfers_out,
  ba.opening_balance
    + COALESCE(i.total, 0)
    - COALESCE(ex.total, 0)
    + COALESCE(ti.total, 0)
    - COALESCE(tout.total, 0) AS balance
FROM bank_accounts ba
LEFT JOIN inflows       i    ON i.account_id    = ba.id
LEFT JOIN expenses      ex   ON ex.account_id   = ba.id
LEFT JOIN transfers_in  ti   ON ti.account_id   = ba.id
LEFT JOIN transfers_out tout ON tout.account_id = ba.id
WHERE ba.is_active = true
ORDER BY ba.account_number;

-- 4) Пересоздаём помесячное представление: opening_balance прибавляется
--    к running_balance первого месяца (это эквивалентно «нулевой» строке).
DROP VIEW IF EXISTS bank_account_balances_monthly;

CREATE VIEW bank_account_balances_monthly AS
WITH months AS (
  SELECT
    ba.id             AS account_id,
    ba.account_number,
    ba.opening_balance,
    date_trunc('month', e.doc_date)::date AS month_start,
    SUM(e.amount) FILTER (WHERE e.doc_type IN ('receipt','debt_correction'))                                      AS inflows,
    SUM(e.amount) FILTER (WHERE e.doc_type = 'expense')                                                           AS expenses,
    SUM(e.amount) FILTER (WHERE e.doc_type = 'internal_transfer' AND e.analytics_dt LIKE ba.account_number || '%') AS transfers_in,
    SUM(e.amount) FILTER (WHERE e.doc_type = 'internal_transfer' AND e.analytics_kt LIKE ba.account_number || '%') AS transfers_out
  FROM bank_accounts ba
  JOIN etl_1c_entries e ON e.bank_account_id = ba.id
  WHERE ba.is_active = true
  GROUP BY ba.id, ba.account_number, ba.opening_balance, date_trunc('month', e.doc_date)
)
SELECT
  account_id,
  account_number,
  to_char(month_start, 'YYYY-MM') AS month,
  month_start,
  COALESCE(inflows, 0)       AS inflows,
  COALESCE(expenses, 0)      AS expenses,
  COALESCE(transfers_in, 0)  AS transfers_in,
  COALESCE(transfers_out, 0) AS transfers_out,
  COALESCE(inflows, 0)
    - COALESCE(expenses, 0)
    + COALESCE(transfers_in, 0)
    - COALESCE(transfers_out, 0) AS month_delta,
  opening_balance
    + SUM(
        COALESCE(inflows, 0)
          - COALESCE(expenses, 0)
          + COALESCE(transfers_in, 0)
          - COALESCE(transfers_out, 0)
      ) OVER (PARTITION BY account_id ORDER BY month_start) AS running_balance
FROM months
ORDER BY account_id, month_start;
