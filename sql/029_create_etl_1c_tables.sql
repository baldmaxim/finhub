-- =============================================================
-- 029: ETL-шлюз 1С → БДДС
-- Импорт карточки счета 62 (детализация по проводкам)
-- Колонки: Период | Документ | Аналитика Дт | Аналитика Кт |
--          Дебет Счет | Кредит Счет | Кредит Сумма | Текущее сальдо
-- Идемпотентная миграция (безопасно перезапускать)
-- =============================================================

-- Удаляем старые функции от предыдущей версии миграции (если есть)
DROP FUNCTION IF EXISTS etl_manual_route(uuid, uuid, uuid, boolean);
DROP FUNCTION IF EXISTS etl_manual_route(uuid, uuid, uuid, boolean, boolean);
DROP FUNCTION IF EXISTS etl_route_batch(uuid);
DROP FUNCTION IF EXISTS etl_route_transaction(uuid);
DROP FUNCTION IF EXISTS etl_route_debt_correction(uuid);

-- Удаляем старые таблицы от предыдущей версии (если есть)
DROP TABLE IF EXISTS etl_1c_transactions CASCADE;
DROP TABLE IF EXISTS etl_1c_bank_account_map CASCADE;
DROP TABLE IF EXISTS etl_1c_cashflow_item_map CASCADE;

-- 1) Маппинг: контрагент + договор → проект
CREATE TABLE IF NOT EXISTS etl_1c_contract_map (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  counterparty_name TEXT NOT NULL,
  contract_name TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(counterparty_name, contract_name)
);

CREATE INDEX IF NOT EXISTS idx_etl_contract_map_project
  ON etl_1c_contract_map(project_id);

-- 2) Regex-маски для определения статьи БДДС по полю «Документ»
CREATE TABLE IF NOT EXISTS etl_1c_payment_masks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern TEXT NOT NULL,
  description TEXT,
  category_id UUID NOT NULL REFERENCES bdds_categories(id) ON DELETE CASCADE,
  priority INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Предзаполнение стандартных масок
INSERT INTO etl_1c_payment_masks (pattern, description, category_id, priority)
SELECT mask.pattern, mask.description, cat.id, mask.priority
FROM (VALUES
  ('(?i)аванс', 'Авансовые платежи', 'Авансы от Заказчика (на обычный р/с)', 10),
  ('(?i)гарантийн.*удержан', 'Возврат гарантийных удержаний', 'Возврат гарантийных удержаний от Заказчика', 20),
  ('(?i)(за\s+(выполненные\s+)?работ|за\s+СМР|выполнение\s+СМР)', 'Оплата за работы/СМР', 'Оплата от Заказчика за выполненные работы (на обычный р/с)', 30)
) AS mask(pattern, description, cat_name, priority)
JOIN bdds_categories cat ON cat.name = mask.cat_name
WHERE NOT EXISTS (
  SELECT 1 FROM etl_1c_payment_masks pm WHERE pm.pattern = mask.pattern
);

-- 3) Импортированные проводки из карточки счета 62
CREATE TABLE IF NOT EXISTS etl_1c_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Сырые данные из Excel
  doc_date DATE NOT NULL,
  document TEXT,
  analytics_dt TEXT,
  analytics_kt TEXT,
  debit_account TEXT,
  credit_account TEXT,
  amount NUMERIC(18,2) NOT NULL,
  -- Распарсенные поля
  doc_type TEXT NOT NULL CHECK (doc_type IN ('receipt', 'debt_correction', 'other')),
  counterparty_name TEXT,
  contract_name TEXT,
  -- Результат маршрутизации
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'routed', 'quarantine', 'manual')),
  routed_project_id UUID REFERENCES projects(id),
  routed_category_id UUID REFERENCES bdds_categories(id),
  route_method TEXT CHECK (route_method IN ('auto', 'regex', 'manual')),
  route_log TEXT,
  -- Метаданные импорта
  import_batch_id UUID NOT NULL,
  imported_at TIMESTAMPTZ DEFAULT now(),
  routed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_etl_entries_status ON etl_1c_entries(status);
CREATE INDEX IF NOT EXISTS idx_etl_entries_batch ON etl_1c_entries(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_etl_entries_date ON etl_1c_entries(doc_date);

-- 4) RPC: маршрутизация всех pending записей батча
CREATE OR REPLACE FUNCTION etl_route_batch(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry RECORD;
  v_map RECORD;
  v_routed INT := 0;
  v_quarantine INT := 0;
  v_year INT;
  v_month INT;
  v_category_id UUID;
  v_method TEXT;
  v_log TEXT;
  v_income_cat_id UUID;
  v_expense_cat_id UUID;
BEGIN
  -- Кэшируем ID категорий РП
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
      v_log := 'no contract mapping';
      UPDATE etl_1c_entries SET status = 'quarantine', route_log = v_log, updated_at = now()
      WHERE id = v_entry.id;
      v_quarantine := v_quarantine + 1;
      CONTINUE;
    END IF;

    v_year := EXTRACT(YEAR FROM v_entry.doc_date)::INT;
    v_month := EXTRACT(MONTH FROM v_entry.doc_date)::INT;

    -- === Корректировка долга → зеркальные записи РП ===
    IF v_entry.doc_type = 'debt_correction' THEN
      IF v_income_cat_id IS NULL OR v_expense_cat_id IS NULL THEN
        v_log := 'RP categories not found in bdds_categories';
        UPDATE etl_1c_entries SET status = 'quarantine', route_log = v_log, updated_at = now()
        WHERE id = v_entry.id;
        v_quarantine := v_quarantine + 1;
        CONTINUE;
      END IF;

      -- Поступление (виртуальное)
      INSERT INTO bdds_entries (category_id, year, month, amount, entry_type, project_id, updated_at)
      VALUES (v_income_cat_id, v_year, v_month, v_entry.amount, 'fact', v_map.project_id, now())
      ON CONFLICT (category_id, year, month, entry_type, project_id)
      DO UPDATE SET amount = bdds_entries.amount + EXCLUDED.amount, updated_at = now();

      -- Выбытие (виртуальное) — сальдо = 0
      INSERT INTO bdds_entries (category_id, year, month, amount, entry_type, project_id, updated_at)
      VALUES (v_expense_cat_id, v_year, v_month, v_entry.amount, 'fact', v_map.project_id, now())
      ON CONFLICT (category_id, year, month, entry_type, project_id)
      DO UPDATE SET amount = bdds_entries.amount + EXCLUDED.amount, updated_at = now();

      UPDATE etl_1c_entries SET
        status = 'routed', routed_project_id = v_map.project_id,
        routed_category_id = v_income_cat_id, route_method = 'auto',
        route_log = 'debt_correction → RP mirror', routed_at = now(), updated_at = now()
      WHERE id = v_entry.id;
      v_routed := v_routed + 1;
      CONTINUE;
    END IF;

    -- === Поступление на р/с → определяем статью БДДС ===

    -- Приоритет: regex по полю «Документ»
    IF v_entry.document IS NOT NULL AND v_entry.document != '' THEN
      SELECT pm.category_id INTO v_category_id
      FROM etl_1c_payment_masks pm
      WHERE pm.is_active = true AND v_entry.document ~ pm.pattern
      ORDER BY pm.priority ASC
      LIMIT 1;

      IF v_category_id IS NOT NULL THEN
        v_method := 'regex';
        v_log := 'category by regex on document';
      END IF;
    END IF;

    -- Fallback: статья не найдена → карантин
    IF v_category_id IS NULL THEN
      v_log := 'project found, category unknown (no regex match)';
      UPDATE etl_1c_entries SET
        status = 'quarantine', routed_project_id = v_map.project_id,
        route_log = v_log, updated_at = now()
      WHERE id = v_entry.id;
      v_quarantine := v_quarantine + 1;
      CONTINUE;
    END IF;

    -- Записываем в БДДС
    INSERT INTO bdds_entries (category_id, year, month, amount, entry_type, project_id, updated_at)
    VALUES (v_category_id, v_year, v_month, v_entry.amount, 'fact', v_map.project_id, now())
    ON CONFLICT (category_id, year, month, entry_type, project_id)
    DO UPDATE SET amount = bdds_entries.amount + EXCLUDED.amount, updated_at = now();

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

-- 5) RPC: ручное разнесение из карантина
CREATE OR REPLACE FUNCTION etl_manual_route(
  p_entry_id UUID,
  p_project_id UUID,
  p_category_id UUID,
  p_save_rule BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry RECORD;
  v_year INT;
  v_month INT;
BEGIN
  SELECT * INTO v_entry FROM etl_1c_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Entry not found');
  END IF;

  v_year := EXTRACT(YEAR FROM v_entry.doc_date)::INT;
  v_month := EXTRACT(MONTH FROM v_entry.doc_date)::INT;

  -- Записываем в БДДС
  INSERT INTO bdds_entries (category_id, year, month, amount, entry_type, project_id, updated_at)
  VALUES (p_category_id, v_year, v_month, v_entry.amount, 'fact', p_project_id, now())
  ON CONFLICT (category_id, year, month, entry_type, project_id)
  DO UPDATE SET amount = bdds_entries.amount + EXCLUDED.amount, updated_at = now();

  -- Обновляем запись
  UPDATE etl_1c_entries SET
    status = 'manual', routed_project_id = p_project_id,
    routed_category_id = p_category_id, route_method = 'manual',
    route_log = 'manually routed', routed_at = now(), updated_at = now()
  WHERE id = p_entry_id;

  -- Дообучение: сохраняем маппинг контрагент+договор → проект
  IF p_save_rule AND v_entry.counterparty_name IS NOT NULL AND v_entry.contract_name IS NOT NULL THEN
    INSERT INTO etl_1c_contract_map (counterparty_name, contract_name, project_id)
    VALUES (v_entry.counterparty_name, v_entry.contract_name, p_project_id)
    ON CONFLICT (counterparty_name, contract_name) DO UPDATE SET
      project_id = EXCLUDED.project_id, updated_at = now();
  END IF;

  RETURN jsonb_build_object('status', 'manual', 'saved_rule', p_save_rule);
END;
$$;

-- RLS
ALTER TABLE etl_1c_contract_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE etl_1c_payment_masks ENABLE ROW LEVEL SECURITY;
ALTER TABLE etl_1c_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "etl_contract_map_all" ON etl_1c_contract_map;
CREATE POLICY "etl_contract_map_all" ON etl_1c_contract_map FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "etl_payment_masks_all" ON etl_1c_payment_masks;
CREATE POLICY "etl_payment_masks_all" ON etl_1c_payment_masks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "etl_entries_all" ON etl_1c_entries;
CREATE POLICY "etl_entries_all" ON etl_1c_entries FOR ALL USING (true) WITH CHECK (true);
