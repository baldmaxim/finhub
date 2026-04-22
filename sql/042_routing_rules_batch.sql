-- 042: Маршрутизация через структурные правила (etl_routing_rules)
-- Заменяет regex-first подход на: структурные правила → regex fallback → карантин

CREATE OR REPLACE FUNCTION etl_route_batch(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry        RECORD;
  v_map          RECORD;
  v_rule         RECORD;
  v_routed       INT := 0;
  v_quarantine   INT := 0;
  v_category_id  UUID;
  v_method       TEXT;
  v_log          TEXT;
  v_is_obs       BOOLEAN;
  v_rule_matched BOOLEAN;
  v_skip_bdds    BOOLEAN;
  v_match_text   TEXT;
BEGIN
  FOR v_entry IN
    SELECT * FROM etl_1c_entries
    WHERE import_batch_id = p_batch_id AND status = 'pending'
  LOOP
    v_category_id  := NULL;
    v_method       := NULL;
    v_log          := '';
    v_rule_matched := false;
    v_skip_bdds    := false;

    -- Получаем флаг ОБС банковского счёта записи
    v_is_obs := false;
    IF v_entry.bank_account_id IS NOT NULL THEN
      SELECT COALESCE(ba.is_obs, false) INTO v_is_obs
      FROM bank_accounts ba WHERE ba.id = v_entry.bank_account_id;
    END IF;

    -- === Шаг 1: Структурные правила (etl_routing_rules) ===
    FOR v_rule IN
      SELECT * FROM etl_routing_rules
      WHERE is_active = true
      ORDER BY priority ASC
    LOOP
      -- Проверяем все условия (NULL = любое значение)
      IF (v_rule.match_doc_type IS NULL OR v_rule.match_doc_type = v_entry.doc_type)
      AND (v_rule.match_is_obs IS NULL OR v_rule.match_is_obs = v_is_obs)
      AND (
        v_rule.match_credit_subaccount IS NULL
        OR (v_entry.credit_account IS NOT NULL
            AND v_entry.credit_account LIKE v_rule.match_credit_subaccount || '%')
      )
      THEN
        v_rule_matched := true;
        v_skip_bdds    := v_rule.skip_bdds;
        v_category_id  := v_rule.category_id;
        v_method       := 'rule';
        v_log          := COALESCE(v_rule.description, 'rule:' || v_rule.priority::TEXT);
        EXIT; -- нашли подходящее правило
      END IF;
    END LOOP;

    -- Правило с skip_bdds (напр. internal_transfer) — routed без БДДС
    IF v_rule_matched AND v_skip_bdds THEN
      UPDATE etl_1c_entries SET
        status       = 'routed',
        route_method = 'rule',
        route_log    = v_log,
        routed_at    = now(),
        updated_at   = now()
      WHERE id = v_entry.id;
      v_routed := v_routed + 1;
      CONTINUE;
    END IF;

    -- === Шаг 2: Regex fallback по etl_1c_payment_masks ===
    IF v_category_id IS NULL THEN
      v_match_text := trim(regexp_replace(
        COALESCE(v_entry.document, '') || ' ' || COALESCE(v_entry.payment_purpose, ''),
        '\s+', ' ', 'g'
      ));
      IF v_match_text != '' THEN
        SELECT pm.category_id INTO v_category_id
        FROM etl_1c_payment_masks pm
        WHERE pm.is_active = true AND v_match_text ~* pm.pattern
        ORDER BY pm.priority ASC
        LIMIT 1;

        IF v_category_id IS NOT NULL THEN
          v_method := 'regex';
          v_log    := 'category by regex (fallback)';
        END IF;
      END IF;
    END IF;

    -- Категория не определена → карантин
    IF v_category_id IS NULL THEN
      UPDATE etl_1c_entries SET
        status     = 'quarantine',
        route_log  = 'no matching rule or regex',
        updated_at = now()
      WHERE id = v_entry.id;
      v_quarantine := v_quarantine + 1;
      CONTINUE;
    END IF;

    -- === Шаг 3: Поиск проекта через маппинг контрагент+договор ===
    SELECT * INTO v_map FROM etl_1c_contract_map
    WHERE counterparty_name = v_entry.counterparty_name
      AND contract_name = v_entry.contract_name;

    IF NOT FOUND THEN
      UPDATE etl_1c_entries SET
        status     = 'quarantine',
        route_log  = 'no contract mapping',
        updated_at = now()
      WHERE id = v_entry.id;
      v_quarantine := v_quarantine + 1;
      CONTINUE;
    END IF;

    -- Всё найдено — помечаем как routed
    UPDATE etl_1c_entries SET
      status             = 'routed',
      routed_project_id  = v_map.project_id,
      routed_category_id = v_category_id,
      route_method       = v_method,
      route_log          = v_log,
      routed_at          = now(),
      updated_at         = now()
    WHERE id = v_entry.id;
    v_routed := v_routed + 1;

  END LOOP;

  RETURN jsonb_build_object('routed', v_routed, 'quarantine', v_quarantine);
END;
$$;

-- etl_sync_bdds остаётся без изменений (уже идемпотентна из 033).
-- Делаем doc_type исключения явными для читаемости.
CREATE OR REPLACE FUNCTION etl_sync_bdds()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted       INT;
  v_inserted      INT := 0;
  v_rows          INT;
  v_income_cat_id UUID;
  v_expense_cat_id UUID;
BEGIN
  SELECT id INTO v_income_cat_id  FROM bdds_categories WHERE name = 'Оплата по распред. письмам (РП)' LIMIT 1;
  SELECT id INTO v_expense_cat_id FROM bdds_categories WHERE name = 'Субподряд: оплата по РП'         LIMIT 1;

  -- Удаляем все ETL-факты (идемпотентность)
  DELETE FROM bdds_entries WHERE source = 'etl';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Обычные поступления (не debt_correction, не internal_transfer)
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

  -- Зеркальные поступления по РП (debt_correction — виртуальный доход)
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

  -- Зеркальные расходы по РП (нулевое сальдо)
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

  RETURN jsonb_build_object('deleted', v_deleted, 'inserted', v_inserted);
END;
$$;

-- etl_reroute_quarantine — без изменений, просто переобъявляем для идемпотентности
CREATE OR REPLACE FUNCTION etl_reroute_quarantine()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch_id    UUID;
  v_updated     INT;
  v_route_result JSONB;
  v_sync_result  JSONB;
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
  v_sync_result  := etl_sync_bdds();

  RETURN v_route_result || v_sync_result;
END;
$$;
