-- 059: Дробим reroute-цепочку на 3 независимых RPC — окончательно лечим 504
--
-- Что лечим:
--   После 058 (без MV refresh) /rpc/etl_reroute_quarantine всё ещё 504 —
--   связка quarantine→pending UPDATE + etl_route_batch + etl_sync_bdds
--   на 13 500+ карантина и 200 k+ routed-проводок не укладывается в
--   60-секундный таймаут прокси Supabase.
--
-- Решение:
--   1) etl_reroute_quarantine — ТОЛЬКО маршрутизация. Не вызывает sync.
--      Возвращает {routed, quarantine}. Должен укладываться в 30s.
--   2) etl_sync_bdds — отдельный RPC, клиент вызывает после reroute.
--      Уже без MV-refresh (миграция 058). 30–45s на 200 k routed.
--   3) refresh_bank_balances — переводим на NON-CONCURRENT REFRESH:
--      быстрее в 2–3× (TRUNCATE+INSERT без диффа), ценой
--      кратковременного эксклюзивного лока MV (~3–10s). Для
--      редкого ETL-импорта/перемаршрутизации это допустимо.

-- =============================================================
-- A. etl_reroute_quarantine — без sync_bdds
-- =============================================================
CREATE OR REPLACE FUNCTION etl_reroute_quarantine()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch_id     UUID;
  v_updated      INT;
  v_route_result JSONB;
BEGIN
  v_batch_id := gen_random_uuid();

  UPDATE etl_1c_entries SET
    status             = 'pending',
    import_batch_id    = v_batch_id,
    route_log          = NULL,
    routed_project_id  = NULL,
    routed_category_id = NULL,
    route_method       = NULL,
    routed_at          = NULL,
    updated_at         = now()
  WHERE status = 'quarantine';
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('routed', 0, 'quarantine', 0);
  END IF;

  v_route_result := etl_route_batch(v_batch_id);

  -- ВАЖНО: sync_bdds и refresh_bank_balances вызываются клиентом
  -- отдельными RPC после reroute. Так каждый запрос укладывается в 60s.

  RETURN v_route_result;
END;
$$;

-- =============================================================
-- B. refresh_bank_balances — NON-CONCURRENT REFRESH (быстрее)
-- =============================================================
-- CONCURRENTLY делал дифф со старой MV (медленно на больших агрегатах).
-- Прямой REFRESH = TRUNCATE+INSERT, в 2–3 раза быстрее.
-- Trade-off: на время рефреша MV эксклюзивно блокируется (читатели ждут
-- ~3–10s). Допустимо для ETL-операций.
CREATE OR REPLACE FUNCTION refresh_bank_balances()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW bank_account_balances;
  REFRESH MATERIALIZED VIEW bank_account_balances_monthly;
END;
$$;

-- statement_timeout ставим выше для рефреша, на случай большой истории.
ALTER FUNCTION refresh_bank_balances() SET statement_timeout = '120s';

-- Перечитать схему PostgREST.
NOTIFY pgrst, 'reload schema';
