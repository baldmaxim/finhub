-- 050: Точные остатки по р/с — учёт расходов + двустороннее определение направления
--      внутренних переводов.
--
-- Изменения относительно 036:
--   1) Включаем в расчёт ВСЕ статусы (убираем 'routed'/'manual'-фильтр) — баланс
--      банковского счёта не зависит от того, разнесено ли в БДДС.
--   2) Добавляем вычитание doc_type='expense' (расходов).
--   3) Направление internal_transfer определяем по тексту analytics_dt/analytics_kt:
--        - если 20-значный номер нашего р/с есть в analytics_dt → это приход на него;
--        - если в analytics_kt → это уход с него.
--      Так одна и та же строка ЕЁ-КАРТОЧКИ корректно участвует в балансе нужного р/с.

CREATE OR REPLACE VIEW bank_account_balances AS
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
  COALESCE(i.total, 0)       AS inflows,
  COALESCE(ex.total, 0)      AS expenses,
  COALESCE(ti.total, 0)      AS transfers_in,
  COALESCE(tout.total, 0)    AS transfers_out,
  COALESCE(i.total, 0)
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
