-- 049: Добавляем 'expense' в CHECK doc_type.
-- Парсер теперь различает приход/расход/внутренний перевод для сч.51
-- и помечает списания (Дт 60/76/91, Кт 51) как 'expense'.

ALTER TABLE etl_1c_entries
  DROP CONSTRAINT IF EXISTS etl_1c_entries_doc_type_check;

ALTER TABLE etl_1c_entries
  ADD CONSTRAINT etl_1c_entries_doc_type_check
  CHECK (doc_type IN ('receipt', 'debt_correction', 'internal_transfer', 'expense', 'other'));
