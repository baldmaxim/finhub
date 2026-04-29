-- 062: Составной индекс для курсорной пагинации etl_1c_entries.
--
-- Проблема: GET /rest/v1/etl_1c_entries с
--   order=doc_date.desc,id.desc
--   or(doc_date.lt.X, and(doc_date.eq.X, id.lt.Y))
-- падает в 500 (таймаут PostgREST 8 сек) из-за full scan по таблице.
--
-- Существующий индекс idx_etl_entries_date на (doc_date) не покрывает
-- сортировку по второму ключу (id), Postgres всё равно делает sort.
--
-- Запускать в Supabase SQL Editor по одной команде (CONCURRENTLY
-- не работает внутри транзакции — Editor оборачивает в BEGIN/COMMIT,
-- поэтому используем обычный CREATE INDEX; на больших таблицах
-- лучше выполнить через psql с CONCURRENTLY вручную).

CREATE INDEX IF NOT EXISTS idx_etl_1c_entries_cursor
  ON etl_1c_entries (doc_date DESC, id DESC);

ANALYZE etl_1c_entries;
