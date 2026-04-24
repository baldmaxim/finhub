-- 051: Помесячная разбивка оборотов по р/с — для сверки с карточкой сч.51 из 1С.
-- Те же правила учёта, что и в 050 (bank_account_balances), но в разрезе
-- (bank_account_id, месяц). Остаток считается нарастающим итогом окном.

DROP VIEW IF EXISTS bank_account_balances_monthly;

CREATE VIEW bank_account_balances_monthly AS
WITH months AS (
  SELECT
    ba.id             AS account_id,
    ba.account_number,
    date_trunc('month', e.doc_date)::date AS month_start,
    SUM(e.amount) FILTER (WHERE e.doc_type IN ('receipt','debt_correction'))                                      AS inflows,
    SUM(e.amount) FILTER (WHERE e.doc_type = 'expense')                                                           AS expenses,
    SUM(e.amount) FILTER (WHERE e.doc_type = 'internal_transfer' AND e.analytics_dt LIKE ba.account_number || '%') AS transfers_in,
    SUM(e.amount) FILTER (WHERE e.doc_type = 'internal_transfer' AND e.analytics_kt LIKE ba.account_number || '%') AS transfers_out
  FROM bank_accounts ba
  JOIN etl_1c_entries e ON e.bank_account_id = ba.id
  WHERE ba.is_active = true
  GROUP BY ba.id, ba.account_number, date_trunc('month', e.doc_date)
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
  SUM(
    COALESCE(inflows, 0)
      - COALESCE(expenses, 0)
      + COALESCE(transfers_in, 0)
      - COALESCE(transfers_out, 0)
  ) OVER (PARTITION BY account_id ORDER BY month_start) AS running_balance
FROM months
ORDER BY account_id, month_start;
