-- 068: Пересоздание etl_1c_entries_keyset с явным RETURNS TABLE.
--
-- Зачем: миграция 067 добавила колонку route_pending_session в etl_1c_entries.
-- Функция из 066 объявлена как RETURNS SETOF etl_1c_entries — после ALTER TABLE
-- закешированный rowtype в PostgREST расходится с фактической структурой
-- таблицы и RPC падает в 500 при загрузке новой выписки
-- (getEntriesForDateRange → etl_1c_entries_keyset).
--
-- Решение:
--   1) DROP старой функции.
--   2) Пересоздать с RETURNS TABLE(...) — явный список колонок (только те,
--      что используются клиентом). Это:
--      - обходит проблему SETOF table (rowtype больше не зависит от ALTER TABLE);
--      - уменьшает payload (не тянем route_pending_session, updated_at и пр.);
--      - даёт PostgREST стабильную сигнатуру.
--   3) statement_timeout = '60s' — защита от случайных длинных вызовов.
--   4) NOTIFY pgrst — сбросить кэш схемы.

DROP FUNCTION IF EXISTS etl_1c_entries_keyset(
  text, uuid, date, date, date, uuid, int
);

CREATE OR REPLACE FUNCTION etl_1c_entries_keyset(
  p_status      text DEFAULT NULL,
  p_batch_id    uuid DEFAULT NULL,
  p_min_date    date DEFAULT NULL,
  p_max_date    date DEFAULT NULL,
  p_cursor_date date DEFAULT NULL,
  p_cursor_id   uuid DEFAULT NULL,
  p_limit       int  DEFAULT 500
)
RETURNS TABLE (
  id                     uuid,
  doc_date               date,
  document               text,
  analytics_dt           text,
  analytics_kt           text,
  debit_account          text,
  credit_account         text,
  amount                 numeric,
  doc_type               text,
  counterparty_name      text,
  contract_name          text,
  payment_purpose        text,
  source_type            text,
  status                 text,
  routed_project_id      uuid,
  routed_category_id     uuid,
  route_method           text,
  route_log              text,
  bank_account_id        uuid,
  target_bank_account_id uuid,
  import_batch_id        uuid,
  imported_at            timestamptz,
  routed_at              timestamptz,
  created_at             timestamptz,
  row_index              int
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    e.id,
    e.doc_date,
    e.document,
    e.analytics_dt,
    e.analytics_kt,
    e.debit_account,
    e.credit_account,
    e.amount,
    e.doc_type,
    e.counterparty_name,
    e.contract_name,
    e.payment_purpose,
    e.source_type,
    e.status,
    e.routed_project_id,
    e.routed_category_id,
    e.route_method,
    e.route_log,
    e.bank_account_id,
    e.target_bank_account_id,
    e.import_batch_id,
    e.imported_at,
    e.routed_at,
    e.created_at,
    e.row_index
  FROM etl_1c_entries e
  WHERE (p_status   IS NULL OR e.status = p_status)
    AND (p_batch_id IS NULL OR e.import_batch_id = p_batch_id)
    AND (p_min_date IS NULL OR e.doc_date >= p_min_date)
    AND (p_max_date IS NULL OR e.doc_date <= p_max_date)
    AND (
      p_cursor_date IS NULL
      OR (e.doc_date, e.id) < (p_cursor_date, p_cursor_id)
    )
  ORDER BY e.doc_date DESC, e.id DESC
  LIMIT p_limit;
$$;

ALTER FUNCTION etl_1c_entries_keyset(
  text, uuid, date, date, date, uuid, int
) SET statement_timeout = '60s';

GRANT EXECUTE ON FUNCTION etl_1c_entries_keyset(
  text, uuid, date, date, date, uuid, int
) TO authenticated, anon, service_role;

NOTIFY pgrst, 'reload schema';
