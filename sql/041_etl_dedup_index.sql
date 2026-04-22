-- 041: Дедупликация ETL-записей на стороне БД
-- Уникальный функциональный индекс по бизнес-ключу проводки.
-- COALESCE нужен потому что NULL != NULL в PostgreSQL UNIQUE,
-- из-за чего две строки с NULL counterparty_name не конфликтовали бы.
CREATE UNIQUE INDEX IF NOT EXISTS etl_1c_entries_dedup_idx
  ON etl_1c_entries (
    doc_date,
    amount,
    COALESCE(counterparty_name, ''),
    COALESCE(contract_name, ''),
    COALESCE(debit_account, '')
  );
