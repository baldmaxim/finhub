-- 056: Дата актуальности остатка по расчётному счёту
--
-- Контекст: в карточке «Остатки по расчётным счетам» (BankAccountBalances)
-- цифры строятся по уже загруженным операциям из etl_1c_entries. Если по
-- одному р/с карточка 1С загружена до 22.04.2026, а по другому — только
-- до 31.12.2024, пользователь не различает «свежий» остаток и устаревший.
--
-- Решение: добавить в представление bank_account_balances поле
-- last_operation_date = MAX(doc_date) среди всех проводок счёта
-- (включая internal_transfer как по дебету, так и по кредиту).
-- Если по счёту нет операций — поле = opening_date (если задано) или NULL.

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
),
last_op AS (
  SELECT bank_account_id AS account_id, MAX(doc_date) AS last_date
    FROM etl_1c_entries
   WHERE bank_account_id IS NOT NULL
   GROUP BY bank_account_id
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
    - COALESCE(tout.total, 0) AS balance,
  COALESCE(lo.last_date, ba.opening_date) AS last_operation_date
FROM bank_accounts ba
LEFT JOIN inflows       i    ON i.account_id    = ba.id
LEFT JOIN expenses      ex   ON ex.account_id   = ba.id
LEFT JOIN transfers_in  ti   ON ti.account_id   = ba.id
LEFT JOIN transfers_out tout ON tout.account_id = ba.id
LEFT JOIN last_op       lo   ON lo.account_id   = ba.id
WHERE ba.is_active = true
ORDER BY ba.account_number;
