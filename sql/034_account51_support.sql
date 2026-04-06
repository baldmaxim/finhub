-- 034: Поддержка карточки счета 51 + поле payment_purpose

-- 1) Поле «Назначение платежа» для карточки счета 51
ALTER TABLE etl_1c_entries ADD COLUMN IF NOT EXISTS payment_purpose TEXT;

-- 2) Источник импорта: account_62 или account_51
ALTER TABLE etl_1c_entries ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'account_62';

-- 3) Обновляем etl_route_batch — regex матчит и по document, и по payment_purpose
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
  v_match_text TEXT;
BEGIN
  SELECT id INTO v_income_cat_id FROM bdds_categories WHERE name = 'Оплата по распред. письмам (РП)' LIMIT 1;
  SELECT id INTO v_expense_cat_id FROM bdds_categories WHERE name = 'Субподряд: оплата по РП' LIMIT 1;

  FOR v_entry IN SELECT * FROM etl_1c_entries WHERE import_batch_id = p_batch_id AND status = 'pending'
  LOOP
    v_log := ''; v_category_id := NULL; v_method := NULL;

    SELECT * INTO v_map FROM etl_1c_contract_map
    WHERE counterparty_name = v_entry.counterparty_name AND contract_name = v_entry.contract_name;

    IF NOT FOUND THEN
      UPDATE etl_1c_entries SET status = 'quarantine', route_log = 'no contract mapping', updated_at = now() WHERE id = v_entry.id;
      v_quarantine := v_quarantine + 1; CONTINUE;
    END IF;

    IF v_entry.doc_type = 'debt_correction' THEN
      IF v_income_cat_id IS NULL OR v_expense_cat_id IS NULL THEN
        UPDATE etl_1c_entries SET status = 'quarantine', route_log = 'RP categories not found', updated_at = now() WHERE id = v_entry.id;
        v_quarantine := v_quarantine + 1; CONTINUE;
      END IF;
      UPDATE etl_1c_entries SET status = 'routed', routed_project_id = v_map.project_id, routed_category_id = v_income_cat_id, route_method = 'auto', route_log = 'debt_correction → RP', routed_at = now(), updated_at = now() WHERE id = v_entry.id;
      v_routed := v_routed + 1; CONTINUE;
    END IF;

    -- Regex: пробуем сначала document, затем payment_purpose
    v_match_text := COALESCE(v_entry.document, '') || ' ' || COALESCE(v_entry.payment_purpose, '');
    IF v_match_text IS NOT NULL AND trim(v_match_text) != '' THEN
      SELECT pm.category_id INTO v_category_id
      FROM etl_1c_payment_masks pm
      WHERE pm.is_active = true AND v_match_text ~* pm.pattern
      ORDER BY pm.priority ASC LIMIT 1;

      IF v_category_id IS NOT NULL THEN
        v_method := 'regex'; v_log := 'category by regex';
      END IF;
    END IF;

    IF v_category_id IS NULL THEN
      UPDATE etl_1c_entries SET status = 'quarantine', routed_project_id = v_map.project_id, route_log = 'project found, category unknown (no regex match)', updated_at = now() WHERE id = v_entry.id;
      v_quarantine := v_quarantine + 1; CONTINUE;
    END IF;

    UPDATE etl_1c_entries SET status = 'routed', routed_project_id = v_map.project_id, routed_category_id = v_category_id, route_method = v_method, route_log = v_log, routed_at = now(), updated_at = now() WHERE id = v_entry.id;
    v_routed := v_routed + 1;
  END LOOP;

  RETURN jsonb_build_object('routed', v_routed, 'quarantine', v_quarantine);
END;
$$;
