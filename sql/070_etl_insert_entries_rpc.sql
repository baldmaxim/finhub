-- 070: Серверный bulk insert etl_1c_entries через JSONB-RPC.
--
-- Зачем: PostgREST .from('etl_1c_entries').insert(batch) формирует POST с
-- очень длинным URL ?columns=%22doc_date%22%2C%22document%22%2C... (700+
-- байт списком всех колонок). Такой паттерн срезается локальной TLS-
-- инспекцией антивирусов / DLP-прокси / расширениями браузера ещё до
-- ответа сервера → детерминированный ERR_CONNECTION_RESET, который не
-- лечится ни уменьшением батча, ни ретраями (см. 069 + INSERT_BATCH_SIZE
-- = 100 + withRetry — все три попытки легли одинаково).
--
-- Решение: серверная RPC etl_insert_entries(p_rows jsonb). URL запроса
-- становится /rpc/etl_insert_entries — короткий, не отличается от
-- остальных RPC проекта (etl_route_batch, etl_sync_bdds, etc.), которые
-- проходят без проблем.

CREATE OR REPLACE FUNCTION etl_insert_entries(p_rows jsonb)
RETURNS int
LANGUAGE sql
SECURITY INVOKER
AS $$
  WITH ins AS (
    INSERT INTO etl_1c_entries (
      doc_date, document, analytics_dt, analytics_kt,
      debit_account, credit_account, amount, doc_type,
      counterparty_name, contract_name, payment_purpose,
      source_type, bank_account_id, target_bank_account_id,
      import_batch_id, row_index
    )
    SELECT
      r.doc_date, r.document, r.analytics_dt, r.analytics_kt,
      r.debit_account, r.credit_account, r.amount, r.doc_type,
      r.counterparty_name, r.contract_name, r.payment_purpose,
      r.source_type, r.bank_account_id, r.target_bank_account_id,
      r.import_batch_id, r.row_index
    FROM jsonb_to_recordset(p_rows) AS r(
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
      bank_account_id        uuid,
      target_bank_account_id uuid,
      import_batch_id        uuid,
      row_index              int
    )
    RETURNING 1
  )
  SELECT count(*)::int FROM ins;
$$;

ALTER FUNCTION etl_insert_entries(jsonb) SET statement_timeout = '60s';

GRANT EXECUTE ON FUNCTION etl_insert_entries(jsonb)
  TO authenticated, anon, service_role;

NOTIFY pgrst, 'reload schema';
