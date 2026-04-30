-- 060: Чанковая перемаршрутизация — окончательно лечим 504
--
-- Что лечим:
--   После 059 (etl_reroute_quarantine делает только UPDATE+route_batch,
--   sync_bdds вынесен) всё равно 504 на 13 500+ карантинных строках.
--   Корень — стоимость UPDATE'а: на etl_1c_entries сейчас ~10 индексов
--   (pending_keys, routed_for_sync, status_doc_date и т.д.), массовый
--   UPDATE 13 500 строк × двойное обновление (quarantine→pending →
--   routed/quarantine в route_batch) = 27 000 row-updates × 10 индексов
--   = 270 000 index-update'ов. Не укладывается в 60 c прокси.
--
-- Решение:
--   1) Дробим reroute на чанки по p_limit (по умолчанию 2000) строк.
--      Клиент в цикле вызывает RPC, пока не обработает всё.
--   2) Чтобы не зациклиться на тех же re-quarantine строках — колонка
--      reroute_session UUID. Каждый чанк помечает обработанные строки
--      сессией. Следующий чанк берёт только status='quarantine'
--      AND reroute_session IS DISTINCT FROM current_session.
--   3) Клиент при новом нажатии «Перемаршрутизация» генерирует свежий
--      UUID — все строки опять попадают в обработку (старые сессии
--      просто игнорируются, не мешают).

-- =============================================================
-- A. Колонка reroute_session
-- =============================================================
ALTER TABLE etl_1c_entries
  ADD COLUMN IF NOT EXISTS reroute_session UUID;

-- Лёгкий индекс — выборка карантина исключая текущую сессию.
-- Партиальный, только по quarantine — крошечный.
CREATE INDEX IF NOT EXISTS idx_etl_entries_quarantine_session
  ON etl_1c_entries (reroute_session)
  WHERE status = 'quarantine';

-- =============================================================
-- B. Чанковая etl_reroute_quarantine(p_limit, p_session)
-- =============================================================
-- Сигнатура поменялась — старую функцию без аргументов сносим.
DROP FUNCTION IF EXISTS etl_reroute_quarantine();
DROP FUNCTION IF EXISTS etl_reroute_quarantine(INT);

CREATE OR REPLACE FUNCTION etl_reroute_quarantine(
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

  -- Берём p_limit карантинных строк, ещё НЕ помеченных текущей сессией.
  WITH chunk AS (
    SELECT id
      FROM etl_1c_entries
     WHERE status = 'quarantine'
       AND (reroute_session IS NULL OR reroute_session <> v_session)
     LIMIT p_limit
  ),
  upd AS (
    UPDATE etl_1c_entries e SET
      status             = 'pending',
      import_batch_id    = v_batch_id,
      reroute_session    = v_session,
      route_log          = NULL,
      routed_project_id  = NULL,
      routed_category_id = NULL,
      route_method       = NULL,
      routed_at          = NULL,
      updated_at         = now()
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

  -- Маршрутизируем только что вынутый чанк (по batch_id).
  v_route_result := etl_route_batch(v_batch_id);

  -- Сколько ещё карантинных строк не обработано в текущей сессии.
  SELECT count(*) INTO v_remaining
    FROM etl_1c_entries
   WHERE status = 'quarantine'
     AND (reroute_session IS NULL OR reroute_session <> v_session);

  RETURN v_route_result
      || jsonb_build_object(
           'processed', v_processed,
           'remaining', v_remaining,
           'session',   v_session
         );
END;
$$;

ALTER FUNCTION etl_reroute_quarantine(INT, UUID) SET statement_timeout = '90s';

-- Перечитать схему PostgREST.
NOTIFY pgrst, 'reload schema';
