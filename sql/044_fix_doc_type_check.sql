-- 044: Расширяем CHECK-констрейнт doc_type в etl_1c_entries
-- В миграции 029 было: ('receipt', 'debt_correction', 'other')
-- В миграции 036 ввели логику 'internal_transfer', но CHECK не обновили —
-- из-за чего INSERT проводок внутренних переводов падал с 400.

ALTER TABLE etl_1c_entries
  DROP CONSTRAINT IF EXISTS etl_1c_entries_doc_type_check;

ALTER TABLE etl_1c_entries
  ADD CONSTRAINT etl_1c_entries_doc_type_check
  CHECK (doc_type IN ('receipt', 'debt_correction', 'internal_transfer', 'other'));
