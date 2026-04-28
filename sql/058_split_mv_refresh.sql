-- 058: Разделяем reroute и refresh MV — лечим 504 Gateway Timeout
--
-- Что лечим:
--   /rpc/etl_reroute_quarantine отдаёт 504 после ~60s.
--   Внутри RPC цепочка: reroute → route_batch → sync_bdds → REFRESH MV ×2.
--   На 200 k+ etl_1c_entries REFRESH MATERIALIZED VIEW CONCURRENTLY
--   занимает 30–60s каждый — суммарно превышает 60-секундный таймаут
--   прокси Supabase (statement_timeout PostgreSQL ни при чём, упирается
--   именно прокси).
--
-- Решение:
--   1) Убираем PERFORM refresh_bank_balances() из etl_sync_bdds —
--      RPC теперь делает только маршрутизацию и пересчёт БДДС
--      (укладывается в 60s).
--   2) Клиент вызывает refresh_bank_balances() отдельным RPC после
--      успешного reroute/sync — каждый запрос укладывается в свой 60s.
--   3) Индекс для агрегации etl_sync_bdds — ускоряем 3× INSERT...SELECT
--      по 200 k routed-проводок.

-- =============================================================
-- A. Индекс для агрегации в etl_sync_bdds
-- =============================================================
-- Покрывает WHERE status IN ('routed','manual') AND
-- routed_category_id IS NOT NULL AND routed_project_id IS NOT NULL,
-- плюс GROUP BY (routed_category_id|fixed, year, month, routed_project_id).
CREATE INDEX IF NOT EXISTS idx_etl_entries_routed_for_sync
  ON etl_1c_entries (routed_project_id, routed_category_id, doc_type, doc_date)
  WHERE status IN ('routed', 'manual')
    AND routed_category_id IS NOT NULL
    AND routed_project_id  IS NOT NULL;

-- =============================================================
-- B. etl_sync_bdds — без PERFORM refresh_bank_balances()
-- =============================================================
-- Тело идентично 057, кроме строки PERFORM refresh_bank_balances().
-- MV теперь обновляются клиентом отдельным запросом после reroute/sync.

CREATE OR REPLACE FUNCTION etl_sync_bdds()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted        INT;
  v_inserted       INT := 0;
  v_rows           INT;
  v_income_cat_id  UUID;
  v_expense_cat_id UUID;
BEGIN
  SELECT id INTO v_income_cat_id  FROM bdds_categories WHERE name = 'Оплата по распред. письмам (РП)' LIMIT 1;
  SELECT id INTO v_expense_cat_id FROM bdds_categories WHERE name = 'Субподряд: оплата по РП'         LIMIT 1;

  DELETE FROM bdds_entries WHERE source = 'etl';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  INSERT INTO bdds_entries
    (category_id, year, month, amount, entry_type, project_id, source, updated_at)
  SELECT
    routed_category_id,
    EXTRACT(YEAR  FROM doc_date)::INT,
    EXTRACT(MONTH FROM doc_date)::INT,
    SUM(amount),
    'fact',
    routed_project_id,
    'etl',
    now()
  FROM etl_1c_entries
  WHERE status IN ('routed', 'manual')
    AND doc_type NOT IN ('debt_correction', 'internal_transfer')
    AND routed_category_id IS NOT NULL
    AND routed_project_id  IS NOT NULL
  GROUP BY
    routed_category_id,
    EXTRACT(YEAR  FROM doc_date),
    EXTRACT(MONTH FROM doc_date),
    routed_project_id;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_income_cat_id IS NOT NULL THEN
    INSERT INTO bdds_entries
      (category_id, year, month, amount, entry_type, project_id, source, updated_at)
    SELECT
      v_income_cat_id,
      EXTRACT(YEAR  FROM doc_date)::INT,
      EXTRACT(MONTH FROM doc_date)::INT,
      SUM(amount),
      'fact',
      routed_project_id,
      'etl',
      now()
    FROM etl_1c_entries
    WHERE status IN ('routed', 'manual')
      AND doc_type = 'debt_correction'
      AND routed_project_id IS NOT NULL
    GROUP BY
      EXTRACT(YEAR  FROM doc_date),
      EXTRACT(MONTH FROM doc_date),
      routed_project_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_inserted := v_inserted + v_rows;
  END IF;

  IF v_expense_cat_id IS NOT NULL THEN
    INSERT INTO bdds_entries
      (category_id, year, month, amount, entry_type, project_id, source, updated_at)
    SELECT
      v_expense_cat_id,
      EXTRACT(YEAR  FROM doc_date)::INT,
      EXTRACT(MONTH FROM doc_date)::INT,
      SUM(amount),
      'fact',
      routed_project_id,
      'etl',
      now()
    FROM etl_1c_entries
    WHERE status IN ('routed', 'manual')
      AND doc_type = 'debt_correction'
      AND routed_project_id IS NOT NULL
    GROUP BY
      EXTRACT(YEAR  FROM doc_date),
      EXTRACT(MONTH FROM doc_date),
      routed_project_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_inserted := v_inserted + v_rows;
  END IF;

  -- MV bank_account_balances обновляется клиентом отдельным RPC
  -- refresh_bank_balances() сразу после успешного sync_bdds —
  -- так каждый запрос укладывается в 60s прокси.

  RETURN jsonb_build_object('deleted', v_deleted, 'inserted', v_inserted);
END;
$$;

-- Перечитать схему PostgREST.
NOTIFY pgrst, 'reload schema';
