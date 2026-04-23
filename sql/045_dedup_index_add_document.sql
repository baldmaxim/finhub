-- 045: Пересоздаём уникальный индекс дедупликации etl_1c_entries с учётом document
-- В 041 ключ был (doc_date, amount, counterparty_name, contract_name, debit_account) —
-- это блокировало две реальные оплаты в один день одному контрагенту на одну сумму,
-- отличающиеся только номером п/п. Добавляем document в ключ.

DROP INDEX IF EXISTS etl_1c_entries_dedup_idx;

CREATE UNIQUE INDEX IF NOT EXISTS etl_1c_entries_dedup_idx
  ON etl_1c_entries (
    doc_date,
    amount,
    COALESCE(counterparty_name, ''),
    COALESCE(contract_name, ''),
    COALESCE(debit_account, ''),
    COALESCE(document, '')
  );
