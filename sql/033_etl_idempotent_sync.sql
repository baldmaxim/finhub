-- 033: Идемпотентная схема ETL → БДДС
-- Разделение: route (разметка) и sync (пересчёт фактов)

-- 1) Колонка source в bdds_entries для разделения ETL и ручных фактов
ALTER TABLE bdds_entries ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- Обновляем UNIQUE constraint — теперь с учётом source
ALTER TABLE bdds_entries DROP CONSTRAINT IF EXISTS bdds_entries_unique_key;
ALTER TABLE bdds_entries ADD CONSTRAINT bdds_entries_unique_key
  UNIQUE (category_id, year, month, entry_type, project_id, source);

-- 2) etl_route_batch — ТОЛЬКО разметка, без записи в bdds_entries
CREATE OR REPLACE FUNCTION etl_route_batch(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry RECORD;
  v_map RECORD;
  v_routed INT := 0;
  v_quarantine INT := 0;
  v_category_id UUID;
  v_method TEXT;
  v_log TEXT;
  v_income_cat_id UUID;
  v_expense_cat_id UUID;
BEGIN
  SELECT id INTO v_income_cat_id FROM bdds_categories
    WHERE name = 'Оплата по распред. письмам (РП)' LIMIT 1;
  SELECT id INTO v_expense_cat_id FROM bdds_categories
    WHERE name = 'Субподряд: оплата по РП' LIMIT 1;

  FOR v_entry IN
    SELECT * FROM etl_1c_entries
    WHERE import_batch_id = p_batch_id AND status = 'pending'
  LOOP
    v_log := '';
    v_category_id := NULL;
    v_method := NULL;

    -- Ищем проект по маппингу контрагент+договор
    SELECT * INTO v_map FROM etl_1c_contract_map
    WHERE counterparty_name = v_entry.counterparty_name
      AND contract_name = v_entry.contract_name;

    IF NOT FOUND THEN
      UPDATE etl_1c_entries SET
        status = 'quarantine', route_log = 'no contract mapping', updated_at = now()
      WHERE id = v_entry.id;
      v_quarantine := v_quarantine + 1;
      CONTINUE;
    END IF;

    -- Корректировка долга → зеркальные записи РП
    IF v_entry.doc_type = 'debt_correction' THEN
      IF v_income_cat_id IS NULL OR v_expense_cat_id IS NULL THEN
        UPDATE etl_1c_entries SET
          status = 'quarantine', route_log = 'RP categories not found', updated_at = now()
        WHERE id = v_entry.id;
        v_quarantine := v_quarantine + 1;
        CONTINUE;
      END IF;

      UPDATE etl_1c_entries SET
        status = 'routed', routed_project_id = v_map.project_id,
        routed_category_id = v_income_cat_id, route_method = 'auto',
        route_log = 'debt_correction → RP', routed_at = now(), updated_at = now()
      WHERE id = v_entry.id;
      v_routed := v_routed + 1;
      CONTINUE;
    END IF;

    -- Поступление → regex по документу
    IF v_entry.document IS NOT NULL AND v_entry.document != '' THEN
      SELECT pm.category_id INTO v_category_id
      FROM etl_1c_payment_masks pm
      WHERE pm.is_active = true AND v_entry.document ~* pm.pattern
      ORDER BY pm.priority ASC
      LIMIT 1;

      IF v_category_id IS NOT NULL THEN
        v_method := 'regex';
        v_log := 'category by regex on document';
      END IF;
    END IF;

    IF v_category_id IS NULL THEN
      UPDATE etl_1c_entries SET
        status = 'quarantine', routed_project_id = v_map.project_id,
        route_log = 'project found, category unknown (no regex match)', updated_at = now()
      WHERE id = v_entry.id;
      v_quarantine := v_quarantine + 1;
      CONTINUE;
    END IF;

    UPDATE etl_1c_entries SET
      status = 'routed', routed_project_id = v_map.project_id,
      routed_category_id = v_category_id, route_method = v_method,
      route_log = v_log, routed_at = now(), updated_at = now()
    WHERE id = v_entry.id;
    v_routed := v_routed + 1;
  END LOOP;

  RETURN jsonb_build_object('routed', v_routed, 'quarantine', v_quarantine);
END;
$$;

-- 3) etl_sync_bdds — идемпотентный пересчёт фактов из размеченных записей
CREATE OR REPLACE FUNCTION etl_sync_bdds()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted INT;
  v_inserted INT := 0;
  v_rows INT;
  v_income_cat_id UUID;
  v_expense_cat_id UUID;
BEGIN
  SELECT id INTO v_income_cat_id FROM bdds_categories
    WHERE name = 'Оплата по распред. письмам (РП)' LIMIT 1;
  SELECT id INTO v_expense_cat_id FROM bdds_categories
    WHERE name = 'Субподряд: оплата по РП' LIMIT 1;

  -- Удаляем все ETL-факты
  DELETE FROM bdds_entries WHERE source = 'etl';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Вставляем агрегированные факты из обычных проводок (receipt)
  INSERT INTO bdds_entries (category_id, year, month, amount, entry_type, project_id, source, updated_at)
  SELECT
    routed_category_id,
    EXTRACT(YEAR FROM doc_date)::INT,
    EXTRACT(MONTH FROM doc_date)::INT,
    SUM(amount),
    'fact',
    routed_project_id,
    'etl',
    now()
  FROM etl_1c_entries
  WHERE status IN ('routed', 'manual')
    AND doc_type != 'debt_correction'
    AND routed_category_id IS NOT NULL
    AND routed_project_id IS NOT NULL
  GROUP BY routed_category_id, EXTRACT(YEAR FROM doc_date), EXTRACT(MONTH FROM doc_date), routed_project_id;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Вставляем зеркальные записи РП из корректировок долга
  IF v_income_cat_id IS NOT NULL THEN
    INSERT INTO bdds_entries (category_id, year, month, amount, entry_type, project_id, source, updated_at)
    SELECT
      v_income_cat_id,
      EXTRACT(YEAR FROM doc_date)::INT,
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
    GROUP BY EXTRACT(YEAR FROM doc_date), EXTRACT(MONTH FROM doc_date), routed_project_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_inserted := v_inserted + v_rows;
  END IF;

  IF v_expense_cat_id IS NOT NULL THEN
    INSERT INTO bdds_entries (category_id, year, month, amount, entry_type, project_id, source, updated_at)
    SELECT
      v_expense_cat_id,
      EXTRACT(YEAR FROM doc_date)::INT,
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
    GROUP BY EXTRACT(YEAR FROM doc_date), EXTRACT(MONTH FROM doc_date), routed_project_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_inserted := v_inserted + v_rows;
  END IF;

  RETURN jsonb_build_object('deleted', v_deleted, 'inserted', v_inserted);
END;
$$;

-- 4) etl_reroute_quarantine — обновлённая версия
CREATE OR REPLACE FUNCTION etl_reroute_quarantine()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch_id UUID;
  v_updated INT;
  v_route_result JSONB;
  v_sync_result JSONB;
BEGIN
  v_batch_id := gen_random_uuid();

  UPDATE etl_1c_entries
  SET status = 'pending',
      import_batch_id = v_batch_id,
      route_log = NULL,
      routed_project_id = NULL,
      routed_category_id = NULL,
      route_method = NULL,
      routed_at = NULL,
      updated_at = now()
  WHERE status = 'quarantine';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('routed', 0, 'quarantine', 0);
  END IF;

  v_route_result := etl_route_batch(v_batch_id);

  -- Пересчитываем все факты
  v_sync_result := etl_sync_bdds();

  RETURN v_route_result || v_sync_result;
END;
$$;
