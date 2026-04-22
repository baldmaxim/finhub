-- 040: Структурные правила маршрутизации ETL → БДДС
-- Заменяет хрупкие regex-маски структурными условиями
-- по типу документа, субсчёту и признаку ОБС

-- Добавляем флаг ОБС в bank_accounts (если ещё нет)
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS is_obs BOOLEAN NOT NULL DEFAULT false;

-- Таблица структурных правил маршрутизации
CREATE TABLE IF NOT EXISTS etl_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  priority INT NOT NULL,
  -- Условия (NULL = не проверять = совпадает с любым значением)
  match_doc_type TEXT CHECK (
    match_doc_type IS NULL OR
    match_doc_type IN ('receipt', 'debt_correction', 'internal_transfer', 'other')
  ),
  match_is_obs BOOLEAN,
  match_credit_subaccount TEXT,  -- начало поля credit_account: '62.01', '62.02' и т.д.
  -- Действие
  category_id UUID REFERENCES bdds_categories(id) ON DELETE SET NULL,
  create_mirror_expense BOOLEAN NOT NULL DEFAULT false,
  skip_bdds BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (priority)
);

ALTER TABLE etl_routing_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "etl_routing_rules_all" ON etl_routing_rules;
CREATE POLICY "etl_routing_rules_all" ON etl_routing_rules FOR ALL USING (true) WITH CHECK (true);

-- П1: Внутренние переводы — не попадают в БДДС
INSERT INTO etl_routing_rules
  (priority, match_doc_type, skip_bdds, create_mirror_expense, description)
VALUES
  (10, 'internal_transfer', true, false, 'Внутренние переводы — не попадают в БДДС')
ON CONFLICT (priority) DO NOTHING;

-- П2: Поступление на ОБС-счёт
INSERT INTO etl_routing_rules
  (priority, match_doc_type, match_is_obs, category_id, skip_bdds, create_mirror_expense, description)
SELECT 20, 'receipt', true, cat.id, false, false, 'Поступление на ОБС-счёт'
FROM bdds_categories cat
WHERE cat.name = 'Поступления от Заказчика на ОБС'
ON CONFLICT (priority) DO NOTHING;

-- П3: Корректировка долга (счета 60/76) → РП + зеркальный расход
INSERT INTO etl_routing_rules
  (priority, match_doc_type, category_id, skip_bdds, create_mirror_expense, description)
SELECT 30, 'debt_correction', cat.id, false, true, 'Корректировка долга → Оплата по РП (+ зеркальный расход)'
FROM bdds_categories cat
WHERE cat.name = 'Оплата по распред. письмам (РП)'
ON CONFLICT (priority) DO NOTHING;

-- П4: Субсчёт 62.02 → Авансы от Заказчика
INSERT INTO etl_routing_rules
  (priority, match_doc_type, match_credit_subaccount, category_id, skip_bdds, create_mirror_expense, description)
SELECT 40, 'receipt', '62.02', cat.id, false, false, 'Субсчёт 62.02 → Авансы от Заказчика'
FROM bdds_categories cat
WHERE cat.name = 'Авансы от Заказчика (на обычный р/с)'
ON CONFLICT (priority) DO NOTHING;

-- П5: Субсчёт 62.01 → Оплата за выполненные работы
INSERT INTO etl_routing_rules
  (priority, match_doc_type, match_credit_subaccount, category_id, skip_bdds, create_mirror_expense, description)
SELECT 50, 'receipt', '62.01', cat.id, false, false, 'Субсчёт 62.01 → Оплата за выполненные работы'
FROM bdds_categories cat
WHERE cat.name = 'Оплата от Заказчика за выполненные работы (на обычный р/с)'
ON CONFLICT (priority) DO NOTHING;
