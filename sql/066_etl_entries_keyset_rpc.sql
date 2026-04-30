-- 066: RPC для keyset-пагинации etl_1c_entries.
--
-- Проблема: WHERE (doc_date < X) OR (doc_date = X AND id < Y) —
-- PostgreSQL не использует составной индекс idx_etl_1c_entries_cursor
-- (doc_date DESC, id DESC) как границу. План показывает Index Scan
-- с начала + Filter, удаляющий 185k строк, ~12 сек → таймаут PostgREST (8 c) → 500.
--
-- Решение: row-constructor (doc_date, id) < (X, Y) — корректно использует
-- составной индекс как стартовую границу. Через supabase-js / REST такое
-- условие не выразимо, поэтому оборачиваем в RPC.
--
-- Функция SETOF + LANGUAGE sql STABLE — инлайнится в FROM-клаузе вызова
-- PostgREST, после чего constant folding отбрасывает не использованные
-- ветки (p_status IS NULL и т.п.) и даёт оптимальный план.

CREATE OR REPLACE FUNCTION etl_1c_entries_keyset(
  p_status      text DEFAULT NULL,
  p_batch_id    uuid DEFAULT NULL,
  p_min_date    date DEFAULT NULL,
  p_max_date    date DEFAULT NULL,
  p_cursor_date date DEFAULT NULL,
  p_cursor_id   uuid DEFAULT NULL,
  p_limit       int  DEFAULT 500
) RETURNS SETOF etl_1c_entries
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT *
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

GRANT EXECUTE ON FUNCTION etl_1c_entries_keyset(
  text, uuid, date, date, date, uuid, int
) TO authenticated, anon, service_role;
