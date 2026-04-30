-- 067: Чанковая маршрутизация pending-проводок.
--
-- Зачем: один большой импорт может оставить 100k+ pending-строк (если
-- кнопка "Маршрутизация" не сработала или ушла в timeout). Прогон
-- etl_route_batch(batch_id) на 164k в одной транзакции не укладывается
-- ни в PostgREST (60 c), ни в SQL Editor.
--
-- Решение по аналогии с 060 (etl_reroute_quarantine):
--   1) Чанк p_limit (по умолчанию 2000) pending-строк помечаем сессией.
--   2) Перекладываем чанк в новый import_batch_id.
--   3) Прогоняем etl_route_batch(new_batch_id) — укладывается в 60 c.
--   4) Клиент в цикле зовёт RPC, пока processed > 0.
-- Сессия защищает от зацикливания на тех же re-quarantine строках.

ALTER TABLE etl_1c_entries
  ADD COLUMN IF NOT EXISTS route_pending_session UUID;

-- Партиальный индекс — крошечный, нужен только во время прогона.
CREATE INDEX IF NOT EXISTS idx_etl_entries_pending_session
  ON etl_1c_entries (route_pending_session)
  WHERE status = 'pending';

CREATE OR REPLACE FUNCTION etl_route_pending_chunk(
  p_limit   INT  DEFAULT 2000,
  p_session UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_session       UUID;
  v_batch_id      UUID;
  v_processed     INT;
  v_route_result  JSONB;
  v_remaining     INT;
BEGIN
  v_session  := COALESCE(p_session, gen_random_uuid());
  v_batch_id := gen_random_uuid();

  WITH chunk AS (
    SELECT id
      FROM etl_1c_entries
     WHERE status = 'pending'
       AND (route_pending_session IS NULL OR route_pending_session <> v_session)
     LIMIT p_limit
  ),
  upd AS (
    UPDATE etl_1c_entries e SET
      import_batch_id       = v_batch_id,
      route_pending_session = v_session,
      updated_at            = now()
    FROM chunk c
    WHERE e.id = c.id
    RETURNING e.id
  )
  SELECT COUNT(*) INTO v_processed FROM upd;

  IF v_processed = 0 THEN
    RETURN jsonb_build_object(
      'routed',     0,
      'quarantine', 0,
      'processed',  0,
      'remaining',  0,
      'session',    v_session
    );
  END IF;

  v_route_result := etl_route_batch(v_batch_id);

  SELECT count(*) INTO v_remaining
    FROM etl_1c_entries
   WHERE status = 'pending'
     AND (route_pending_session IS NULL OR route_pending_session <> v_session);

  RETURN v_route_result
      || jsonb_build_object(
           'processed', v_processed,
           'remaining', v_remaining,
           'session',   v_session
         );
END;
$$;

ALTER FUNCTION etl_route_pending_chunk(INT, UUID) SET statement_timeout = '90s';

GRANT EXECUTE ON FUNCTION etl_route_pending_chunk(INT, UUID)
  TO authenticated, anon, service_role;

NOTIFY pgrst, 'reload schema';
