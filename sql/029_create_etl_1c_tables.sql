-- =============================================================
-- 029: ETL-шлюз 1С → БДДС
-- Таблицы: транзакции, маппинг (счета, договоры, статьи),
-- карантин, маски назначений платежей
-- Идемпотентная миграция (безопасно перезапускать)
-- =============================================================

-- 1) Маппинг банковских счетов 1С → тип кошелька
CREATE TABLE IF NOT EXISTS etl_1c_bank_account_map (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guid_1c TEXT NOT NULL UNIQUE,
  account_name TEXT,
  wallet_type TEXT NOT NULL CHECK (wallet_type IN ('free_cash', 'obs')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2) Маппинг договоров 1С → проект на портале
CREATE TABLE IF NOT EXISTS etl_1c_contract_map (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guid_1c TEXT NOT NULL UNIQUE,
  contract_name TEXT,
  counterparty_inn TEXT,
  counterparty_name TEXT,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_etl_contract_map_project
  ON etl_1c_contract_map(project_id);

-- 3) Маппинг статей ДДС 1С → категория БДДС
CREATE TABLE IF NOT EXISTS etl_1c_cashflow_item_map (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guid_1c TEXT NOT NULL UNIQUE,
  item_name TEXT,
  category_id UUID NOT NULL REFERENCES bdds_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4) Regex-маски для fallback-парсинга назначения платежа
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
  ('(?i)за\s+(выполненные\s+)?работ', 'Оплата за выполненные работы', 'Оплата от Заказчика за выполненные работы (на обычный р/с)', 30),
  ('(?i)распред.*письм|(?i)\bРП\b', 'Распределительные письма', 'Оплата по распред. письмам (РП)', 40)
) AS mask(pattern, description, cat_name, priority)
JOIN bdds_categories cat ON cat.name = mask.cat_name
WHERE NOT EXISTS (
  SELECT 1 FROM etl_1c_payment_masks pm WHERE pm.pattern = mask.pattern
);

-- 5) Входящие транзакции из 1С (импорт из Excel)
CREATE TABLE IF NOT EXISTS etl_1c_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Тип документа
  doc_type TEXT NOT NULL CHECK (doc_type IN ('receipt', 'debt_correction')),
  -- Сырые данные из отчёта 1С
  doc_date DATE NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  counterparty_inn TEXT,
  counterparty_name TEXT,
  contract_guid TEXT,
  contract_name TEXT,
  bank_account_guid TEXT,
  bank_account_name TEXT,
  cashflow_item_guid TEXT,
  cashflow_item_name TEXT,
  payment_purpose TEXT,
  -- Для корректировки долга
  sub_contract_guid TEXT,
  sub_contract_name TEXT,
  -- Результат маршрутизации
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'routed', 'quarantine', 'manual')),
  routed_project_id UUID REFERENCES projects(id),
  routed_category_id UUID REFERENCES bdds_categories(id),
  routed_wallet_type TEXT CHECK (routed_wallet_type IN ('free_cash', 'obs')),
  route_method TEXT CHECK (route_method IN ('guid_map', 'regex_mask', 'manual')),
  route_log TEXT,
  -- Метаданные импорта
  import_batch_id UUID,
  imported_at TIMESTAMPTZ DEFAULT now(),
  routed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_etl_transactions_status
  ON etl_1c_transactions(status);
CREATE INDEX IF NOT EXISTS idx_etl_transactions_batch
  ON etl_1c_transactions(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_etl_transactions_date
  ON etl_1c_transactions(doc_date);

-- 6) RPC: маршрутизация одной транзакции
CREATE OR REPLACE FUNCTION etl_route_transaction(p_transaction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_tx RECORD;
  v_project_id UUID;
  v_category_id UUID;
  v_wallet_type TEXT;
  v_method TEXT;
  v_log TEXT := '';
  v_mask RECORD;
BEGIN
  SELECT * INTO v_tx FROM etl_1c_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Transaction not found');
  END IF;

  -- === Шаг 1: Определение кошелька ===
  IF v_tx.bank_account_guid IS NOT NULL AND v_tx.bank_account_guid != '' THEN
    SELECT wallet_type INTO v_wallet_type
    FROM etl_1c_bank_account_map
    WHERE guid_1c = v_tx.bank_account_guid;
  END IF;
  v_log := v_log || 'wallet: ' || COALESCE(v_wallet_type, 'unknown') || '; ';

  -- === Шаг 2: Определение проекта ===
  IF v_tx.contract_guid IS NOT NULL AND v_tx.contract_guid != '' THEN
    SELECT project_id INTO v_project_id
    FROM etl_1c_contract_map
    WHERE guid_1c = v_tx.contract_guid;
  END IF;
  v_log := v_log || 'project: ' || COALESCE(v_project_id::TEXT, 'unknown') || '; ';

  -- === Шаг 3a: Статья по GUID ===
  IF v_tx.cashflow_item_guid IS NOT NULL AND v_tx.cashflow_item_guid != '' THEN
    SELECT category_id INTO v_category_id
    FROM etl_1c_cashflow_item_map
    WHERE guid_1c = v_tx.cashflow_item_guid;
    IF v_category_id IS NOT NULL THEN
      v_method := 'guid_map';
      v_log := v_log || 'category: guid_map; ';
    END IF;
  END IF;

  -- === Шаг 3b: Fallback — regex по назначению платежа ===
  IF v_category_id IS NULL AND v_tx.payment_purpose IS NOT NULL AND v_tx.payment_purpose != '' THEN
    SELECT pm.category_id INTO v_category_id
    FROM etl_1c_payment_masks pm
    WHERE pm.is_active = true
      AND v_tx.payment_purpose ~ pm.pattern
    ORDER BY pm.priority ASC
    LIMIT 1;
    IF v_category_id IS NOT NULL THEN
      v_method := 'regex_mask';
      v_log := v_log || 'category: regex_mask; ';
    END IF;
  END IF;

  -- === Результат ===
  IF v_project_id IS NOT NULL AND v_category_id IS NOT NULL THEN
    UPDATE etl_1c_transactions SET
      status = 'routed',
      routed_project_id = v_project_id,
      routed_category_id = v_category_id,
      routed_wallet_type = v_wallet_type,
      route_method = v_method,
      route_log = v_log,
      routed_at = now(),
      updated_at = now()
    WHERE id = p_transaction_id;

    -- Записываем в bdds_entries (факт)
    INSERT INTO bdds_entries (category_id, year, month, amount, entry_type, project_id, updated_at)
    VALUES (
      v_category_id,
      EXTRACT(YEAR FROM v_tx.doc_date)::INT,
      EXTRACT(MONTH FROM v_tx.doc_date)::INT,
      v_tx.amount,
      'fact',
      v_project_id,
      now()
    )
    ON CONFLICT (category_id, year, month, entry_type, project_id)
    DO UPDATE SET
      amount = bdds_entries.amount + EXCLUDED.amount,
      updated_at = now();

    RETURN jsonb_build_object('status', 'routed', 'project_id', v_project_id, 'category_id', v_category_id);
  ELSE
    UPDATE etl_1c_transactions SET
      status = 'quarantine',
      routed_project_id = v_project_id,
      routed_category_id = v_category_id,
      routed_wallet_type = v_wallet_type,
      route_log = v_log,
      updated_at = now()
    WHERE id = p_transaction_id;

    RETURN jsonb_build_object('status', 'quarantine', 'log', v_log);
  END IF;
END;
$$;

-- 7) RPC: маршрутизация всех pending транзакций батча
CREATE OR REPLACE FUNCTION etl_route_batch(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_tx RECORD;
  v_routed INT := 0;
  v_quarantine INT := 0;
  v_result JSONB;
BEGIN
  FOR v_tx IN
    SELECT id, doc_type FROM etl_1c_transactions
    WHERE import_batch_id = p_batch_id AND status = 'pending'
  LOOP
    IF v_tx.doc_type = 'debt_correction' THEN
      -- Корректировка долга: зеркальные записи
      PERFORM etl_route_debt_correction(v_tx.id);
      v_routed := v_routed + 1;
    ELSE
      v_result := etl_route_transaction(v_tx.id);
      IF v_result->>'status' = 'routed' THEN
        v_routed := v_routed + 1;
      ELSE
        v_quarantine := v_quarantine + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('routed', v_routed, 'quarantine', v_quarantine);
END;
$$;

-- 8) RPC: обработка корректировки долга (зеркальные записи)
CREATE OR REPLACE FUNCTION etl_route_debt_correction(p_transaction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_tx RECORD;
  v_project_id UUID;
  v_income_cat_id UUID;
  v_expense_cat_id UUID;
  v_year INT;
  v_month INT;
BEGIN
  SELECT * INTO v_tx FROM etl_1c_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Transaction not found');
  END IF;

  -- Определяем проект
  IF v_tx.contract_guid IS NOT NULL AND v_tx.contract_guid != '' THEN
    SELECT project_id INTO v_project_id
    FROM etl_1c_contract_map
    WHERE guid_1c = v_tx.contract_guid;
  END IF;

  IF v_project_id IS NULL THEN
    UPDATE etl_1c_transactions SET status = 'quarantine', route_log = 'debt_correction: unknown project', updated_at = now()
    WHERE id = p_transaction_id;
    RETURN jsonb_build_object('status', 'quarantine');
  END IF;

  -- Находим категории РП
  SELECT id INTO v_income_cat_id FROM bdds_categories
  WHERE name = 'Оплата по распред. письмам (РП)' LIMIT 1;

  SELECT id INTO v_expense_cat_id FROM bdds_categories
  WHERE name = 'Субподряд: оплата по РП' LIMIT 1;

  IF v_income_cat_id IS NULL OR v_expense_cat_id IS NULL THEN
    UPDATE etl_1c_transactions SET status = 'quarantine', route_log = 'debt_correction: RP categories not found', updated_at = now()
    WHERE id = p_transaction_id;
    RETURN jsonb_build_object('status', 'quarantine', 'error', 'RP categories not found');
  END IF;

  v_year := EXTRACT(YEAR FROM v_tx.doc_date)::INT;
  v_month := EXTRACT(MONTH FROM v_tx.doc_date)::INT;

  -- Зеркальное поступление
  INSERT INTO bdds_entries (category_id, year, month, amount, entry_type, project_id, updated_at)
  VALUES (v_income_cat_id, v_year, v_month, v_tx.amount, 'fact', v_project_id, now())
  ON CONFLICT (category_id, year, month, entry_type, project_id)
  DO UPDATE SET amount = bdds_entries.amount + EXCLUDED.amount, updated_at = now();

  -- Зеркальное выбытие
  INSERT INTO bdds_entries (category_id, year, month, amount, entry_type, project_id, updated_at)
  VALUES (v_expense_cat_id, v_year, v_month, v_tx.amount, 'fact', v_project_id, now())
  ON CONFLICT (category_id, year, month, entry_type, project_id)
  DO UPDATE SET amount = bdds_entries.amount + EXCLUDED.amount, updated_at = now();

  -- Обновляем транзакцию
  UPDATE etl_1c_transactions SET
    status = 'routed',
    routed_project_id = v_project_id,
    routed_category_id = v_income_cat_id,
    route_method = 'guid_map',
    route_log = 'debt_correction: RP mirror entries created',
    routed_at = now(),
    updated_at = now()
  WHERE id = p_transaction_id;

  RETURN jsonb_build_object('status', 'routed', 'type', 'debt_correction');
END;
$$;

-- 9) RPC: ручное разнесение из карантина
CREATE OR REPLACE FUNCTION etl_manual_route(
  p_transaction_id UUID,
  p_project_id UUID,
  p_category_id UUID,
  p_save_rule BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_tx RECORD;
  v_year INT;
  v_month INT;
BEGIN
  SELECT * INTO v_tx FROM etl_1c_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Transaction not found');
  END IF;

  v_year := EXTRACT(YEAR FROM v_tx.doc_date)::INT;
  v_month := EXTRACT(MONTH FROM v_tx.doc_date)::INT;

  -- Записываем в БДДС
  INSERT INTO bdds_entries (category_id, year, month, amount, entry_type, project_id, updated_at)
  VALUES (p_category_id, v_year, v_month, v_tx.amount, 'fact', p_project_id, now())
  ON CONFLICT (category_id, year, month, entry_type, project_id)
  DO UPDATE SET amount = bdds_entries.amount + EXCLUDED.amount, updated_at = now();

  -- Обновляем транзакцию
  UPDATE etl_1c_transactions SET
    status = 'manual',
    routed_project_id = p_project_id,
    routed_category_id = p_category_id,
    route_method = 'manual',
    route_log = 'manually routed by user',
    routed_at = now(),
    updated_at = now()
  WHERE id = p_transaction_id;

  -- Дообучение: сохраняем маппинг договора
  IF p_save_rule AND v_tx.contract_guid IS NOT NULL AND v_tx.contract_guid != '' THEN
    INSERT INTO etl_1c_contract_map (guid_1c, contract_name, counterparty_inn, counterparty_name, project_id)
    VALUES (v_tx.contract_guid, v_tx.contract_name, v_tx.counterparty_inn, v_tx.counterparty_name, p_project_id)
    ON CONFLICT (guid_1c) DO UPDATE SET
      project_id = EXCLUDED.project_id,
      contract_name = COALESCE(EXCLUDED.contract_name, etl_1c_contract_map.contract_name),
      updated_at = now();
  END IF;

  -- Дообучение: сохраняем маппинг статьи ДДС
  IF p_save_rule AND v_tx.cashflow_item_guid IS NOT NULL AND v_tx.cashflow_item_guid != '' THEN
    INSERT INTO etl_1c_cashflow_item_map (guid_1c, item_name, category_id)
    VALUES (v_tx.cashflow_item_guid, v_tx.cashflow_item_name, p_category_id)
    ON CONFLICT (guid_1c) DO UPDATE SET
      category_id = EXCLUDED.category_id,
      item_name = COALESCE(EXCLUDED.item_name, etl_1c_cashflow_item_map.item_name),
      updated_at = now();
  END IF;

  RETURN jsonb_build_object('status', 'manual', 'saved_rule', p_save_rule);
END;
$$;

-- RLS
ALTER TABLE etl_1c_bank_account_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE etl_1c_contract_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE etl_1c_cashflow_item_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE etl_1c_payment_masks ENABLE ROW LEVEL SECURITY;
ALTER TABLE etl_1c_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etl_bank_account_map_all" ON etl_1c_bank_account_map FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "etl_contract_map_all" ON etl_1c_contract_map FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "etl_cashflow_item_map_all" ON etl_1c_cashflow_item_map FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "etl_payment_masks_all" ON etl_1c_payment_masks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "etl_transactions_all" ON etl_1c_transactions FOR ALL USING (true) WITH CHECK (true);
