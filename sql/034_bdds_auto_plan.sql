-- =============================================================
-- 034: БДДС Авто — плановый генератор + усиленный ETL-роутинг
-- Интеграция параметров досье договора с БДДС
-- Идемпотентная миграция (безопасно перезапускать)
-- =============================================================

-- 1) ОБС-флаг на расчётных счетах
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS is_obs BOOLEAN NOT NULL DEFAULT false;

-- 2) Таблица планового графика КС-2 (входные данные для генератора)
CREATE TABLE IF NOT EXISTS bdds_ks_plan (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  year         INT NOT NULL,
  month        INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  ks_amount    NUMERIC(18,2) NOT NULL DEFAULT 0,   -- Плановая сумма КС-2 (с НДС)
  a_remaining  NUMERIC(18,2) NOT NULL DEFAULT 0,   -- Остаток нецелевого аванса
  w_remaining  NUMERIC(18,2) NOT NULL DEFAULT 0,   -- Стоимость невыполненных работ
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_bdds_ks_plan_project_year
  ON bdds_ks_plan(project_id, year);

ALTER TABLE bdds_ks_plan ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bdds_ks_plan_all" ON bdds_ks_plan;
CREATE POLICY "bdds_ks_plan_all" ON bdds_ks_plan FOR ALL USING (true) WITH CHECK (true);

-- 3) Добавляем OPEX-категории расходов если ещё нет
INSERT INTO bdds_categories (section_code, row_type, name, sort_order, is_calculated, parent_id)
SELECT 'operating', 'expense', child.name, child.sort_order, false, parent.id
FROM bdds_categories parent,
(VALUES
  ('Комиссия по банковским гарантиям', 10),
  ('Страхование', 11)
) AS child(name, sort_order)
WHERE parent.name = 'Выплата средств по текущей деятельности'
  AND parent.section_code = 'operating'
  AND parent.row_type = 'expense'
  AND NOT EXISTS (
    SELECT 1 FROM bdds_categories bc
    WHERE bc.name = child.name AND bc.parent_id = parent.id
  );

-- 4) etl_route_batch v3: ОБС-счёт → субсчёт 62.01/62.02 → ГУ-маркер → regex
CREATE OR REPLACE FUNCTION etl_route_batch(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry       RECORD;
  v_map         RECORD;
  v_routed      INT := 0;
  v_quarantine  INT := 0;
  v_category_id UUID;
  v_method      TEXT;
  v_log         TEXT;
  v_bank_is_obs BOOLEAN;
  -- Кэш категорий
  v_cat_rp_income  UUID;
  v_cat_rp_expense UUID;
  v_cat_advance    UUID;
  v_cat_obs        UUID;
  v_cat_works      UUID;
  v_cat_gu_return  UUID;
BEGIN
  SELECT id INTO v_cat_rp_income  FROM bdds_categories WHERE name = 'Оплата по распред. письмам (РП)'                             LIMIT 1;
  SELECT id INTO v_cat_rp_expense FROM bdds_categories WHERE name = 'Субподряд: оплата по РП'                                     LIMIT 1;
  SELECT id INTO v_cat_advance    FROM bdds_categories WHERE name = 'Авансы от Заказчика (на обычный р/с)'                        LIMIT 1;
  SELECT id INTO v_cat_obs        FROM bdds_categories WHERE name = 'Поступления от Заказчика на ОБС'                             LIMIT 1;
  SELECT id INTO v_cat_works      FROM bdds_categories WHERE name = 'Оплата от Заказчика за выполненные работы (на обычный р/с)'  LIMIT 1;
  SELECT id INTO v_cat_gu_return  FROM bdds_categories WHERE name = 'Возврат гарантийных удержаний от Заказчика'                  LIMIT 1;

  FOR v_entry IN
    SELECT * FROM etl_1c_entries
    WHERE import_batch_id = p_batch_id AND status = 'pending'
  LOOP
    v_log         := '';
    v_category_id := NULL;
    v_method      := NULL;
    v_bank_is_obs := false;

    -- Ищем проект по маппингу контрагент+договор
    SELECT * INTO v_map FROM etl_1c_contract_map
    WHERE counterparty_name = v_entry.counterparty_name
      AND contract_name     = v_entry.contract_name;

    IF NOT FOUND THEN
      UPDATE etl_1c_entries SET
        status = 'quarantine', route_log = 'no contract mapping', updated_at = now()
      WHERE id = v_entry.id;
      v_quarantine := v_quarantine + 1;
      CONTINUE;
    END IF;

    -- Корректировка долга → зеркальные записи РП
    IF v_entry.doc_type = 'debt_correction' THEN
      IF v_cat_rp_income IS NULL OR v_cat_rp_expense IS NULL THEN
        UPDATE etl_1c_entries SET
          status = 'quarantine', route_log = 'RP categories not found', updated_at = now()
        WHERE id = v_entry.id;
        v_quarantine := v_quarantine + 1;
        CONTINUE;
      END IF;

      UPDATE etl_1c_entries SET
        status = 'routed', routed_project_id = v_map.project_id,
        routed_category_id = v_cat_rp_income, route_method = 'auto',
        route_log = 'debt_correction → RP', routed_at = now(), updated_at = now()
      WHERE id = v_entry.id;
      v_routed := v_routed + 1;
      CONTINUE;
    END IF;

    -- === Поступление → определяем статью БДДС ===

    -- Приоритет 1: ОБС-счёт
    IF v_entry.bank_account_id IS NOT NULL AND v_cat_obs IS NOT NULL THEN
      SELECT is_obs INTO v_bank_is_obs
      FROM bank_accounts WHERE id = v_entry.bank_account_id;

      IF v_bank_is_obs THEN
        v_category_id := v_cat_obs;
        v_method      := 'obs_account';
        v_log         := 'bank_account.is_obs=true → ОБС';
      END IF;
    END IF;

    -- Приоритет 2: субсчёт 62.01 / 62.02
    IF v_category_id IS NULL AND v_entry.credit_account IS NOT NULL THEN
      IF v_entry.credit_account LIKE '62.02%' AND v_cat_advance IS NOT NULL THEN
        v_category_id := v_cat_advance;
        v_method      := 'subaccount';
        v_log         := 'Кт 62.02 → Авансы от Заказчика';
      ELSIF v_entry.credit_account LIKE '62.01%' AND v_cat_works IS NOT NULL THEN
        v_category_id := v_cat_works;
        v_method      := 'subaccount';
        v_log         := 'Кт 62.01 → Оплата за выполненные работы';
      END IF;
    END IF;

    -- Приоритет 3: маркер ГУ в назначении платежа / документе
    IF v_category_id IS NULL AND v_cat_gu_return IS NOT NULL THEN
      IF (v_entry.payment_purpose IS NOT NULL AND v_entry.payment_purpose ~* 'гарантийн.{0,20}удержан')
      OR (v_entry.document IS NOT NULL        AND v_entry.document        ~* 'гарантийн.{0,20}удержан') THEN
        v_category_id := v_cat_gu_return;
        v_method      := 'regex';
        v_log         := 'маркер ГУ в назначении → Возврат гарантийных удержаний';
      END IF;
    END IF;

    -- Приоритет 4: regex-маски по полю «Документ»
    IF v_category_id IS NULL AND v_entry.document IS NOT NULL AND v_entry.document != '' THEN
      SELECT pm.category_id INTO v_category_id
      FROM etl_1c_payment_masks pm
      WHERE pm.is_active = true AND v_entry.document ~* pm.pattern
      ORDER BY pm.priority ASC
      LIMIT 1;

      IF v_category_id IS NOT NULL THEN
        v_method := 'regex';
        v_log    := 'category by regex on document';
      END IF;
    END IF;

    -- Карантин если категория не определена
    IF v_category_id IS NULL THEN
      UPDATE etl_1c_entries SET
        status = 'quarantine', routed_project_id = v_map.project_id,
        route_log = 'project found, category unknown', updated_at = now()
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

-- 5) bdds_generate_plan_from_dossier
-- Принимает: проект + год
-- Читает: bdds_ks_plan (график КС-2) + dosier (параметры договора)
-- Записывает: bdds_entries (entry_type='plan', source='dossier')
CREATE OR REPLACE FUNCTION bdds_generate_plan_from_dossier(
  p_project_id UUID,
  p_year       INT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_dossier             RECORD;
  v_ks_row              RECORD;
  -- расчётные переменные
  v_lag_days            INT;
  v_lag_months          INT;
  v_pay_year            INT;
  v_pay_month           INT;
  v_net_cash            NUMERIC;
  v_offset_target       NUMERIC;
  v_offset_nontarget    NUMERIC;
  v_gu_amount           NUMERIC;
  v_total_gu            NUMERIC := 0;
  v_inserted            INT     := 0;
  v_monthly_insurance   NUMERIC;
  v_gu_return_date      DATE;
  v_gu_year             INT;
  v_gu_month            INT;
  v_m                   INT;
  -- категории БДДС
  v_cat_works      UUID;
  v_cat_gu_return  UUID;
  v_cat_insurance  UUID;
BEGIN
  -- Получаем эффективные параметры досье:
  -- приоритет ДС (amendment) над базовым договором, последний по дате
  SELECT
    COALESCE((header_data->>'contract_amount')::NUMERIC, 0)       AS contract_amount,
    (header_data->>'start_date')                                   AS start_date,
    (header_data->>'end_date')                                     AS end_date,
    COALESCE((bdds_data->>'advance_payment_days')::INT,  20)       AS advance_payment_days,
    COALESCE((bdds_data->>'preferential_advance_pct')::NUMERIC, 0) AS preferential_advance_pct,
    COALESCE((bdds_data->>'ks2_submission_day')::INT,    5)        AS ks2_submission_day,
    COALESCE((bdds_data->>'ks2_acceptance_days')::INT,  15)        AS ks2_acceptance_days,
    COALESCE((bdds_data->>'ks2_payment_days')::INT,     15)        AS ks2_payment_days,
    COALESCE((bdds_data->>'gu_rate_pct')::NUMERIC,       0)        AS gu_rate_pct,
    COALESCE((bdds_data->>'gu_return_months')::INT,     24)        AS gu_return_months,
    COALESCE((bdr_data->>'insurance_go_amount')::NUMERIC, 0)       AS insurance_go_amount
  INTO v_dossier
  FROM contract_dossiers
  WHERE project_id = p_project_id AND is_active = true
  ORDER BY
    (CASE WHEN document_type = 'amendment' THEN 1 ELSE 0 END) DESC,
    document_date DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Досье не найдено для проекта');
  END IF;

  -- Кэш ID категорий БДДС
  SELECT id INTO v_cat_works
    FROM bdds_categories WHERE name = 'Оплата от Заказчика за выполненные работы (на обычный р/с)' LIMIT 1;
  SELECT id INTO v_cat_gu_return
    FROM bdds_categories WHERE name = 'Возврат гарантийных удержаний от Заказчика' LIMIT 1;
  SELECT id INTO v_cat_insurance
    FROM bdds_categories WHERE name = 'Страхование' LIMIT 1;

  -- Удаляем ранее сгенерированные плановые записи за этот год
  DELETE FROM bdds_entries
  WHERE project_id = p_project_id
    AND year       = p_year
    AND entry_type = 'plan'
    AND source     = 'dossier';

  -- Лаг оплаты в месяцах
  v_lag_days   := v_dossier.ks2_submission_day + v_dossier.ks2_acceptance_days + v_dossier.ks2_payment_days;
  v_lag_months := CEIL(v_lag_days::NUMERIC / 30.0)::INT;

  -- Перебираем строки графика КС-2
  FOR v_ks_row IN
    SELECT year, month, ks_amount, a_remaining, w_remaining
    FROM bdds_ks_plan
    WHERE project_id = p_project_id AND year = p_year
    ORDER BY year, month
  LOOP
    -- Зачет нецелевого аванса: Aост / Wрем × Wфакт
    IF v_ks_row.w_remaining > 0 THEN
      v_offset_nontarget := (v_ks_row.a_remaining / v_ks_row.w_remaining) * v_ks_row.ks_amount;
    ELSE
      v_offset_nontarget := 0;
    END IF;

    -- Зачет целевого аванса (льготного)
    v_offset_target := (v_dossier.preferential_advance_pct / 100.0) * v_ks_row.ks_amount;

    -- ГУ удержание
    v_gu_amount := (v_dossier.gu_rate_pct / 100.0) * v_ks_row.ks_amount;
    v_total_gu  := v_total_gu + v_gu_amount;

    -- Нетто к получению
    v_net_cash := v_ks_row.ks_amount - v_offset_target - v_offset_nontarget - v_gu_amount;
    IF v_net_cash <= 0 THEN CONTINUE; END IF;

    -- Месяц поступления = период КС + лаг
    v_pay_month := v_ks_row.month + v_lag_months;
    v_pay_year  := v_ks_row.year;
    WHILE v_pay_month > 12 LOOP
      v_pay_month := v_pay_month - 12;
      v_pay_year  := v_pay_year + 1;
    END LOOP;

    -- Запись плановой оплаты за работы (только в рамках запрошенного года)
    IF v_cat_works IS NOT NULL AND v_pay_year = p_year THEN
      INSERT INTO bdds_entries
        (category_id, year, month, amount, entry_type, project_id, source, updated_at)
      VALUES
        (v_cat_works, v_pay_year, v_pay_month, v_net_cash, 'plan', p_project_id, 'dossier', now())
      ON CONFLICT (category_id, year, month, entry_type, project_id, source)
        DO UPDATE SET amount = bdds_entries.amount + EXCLUDED.amount, updated_at = now();
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  -- Плановый возврат ГУ (конец договора + gu_return_months)
  IF v_total_gu > 0 AND v_cat_gu_return IS NOT NULL AND v_dossier.end_date IS NOT NULL THEN
    v_gu_return_date := (v_dossier.end_date::DATE
                         + (v_dossier.gu_return_months || ' months')::INTERVAL)::DATE;
    v_gu_year  := EXTRACT(YEAR  FROM v_gu_return_date)::INT;
    v_gu_month := EXTRACT(MONTH FROM v_gu_return_date)::INT;

    IF v_gu_year = p_year THEN
      INSERT INTO bdds_entries
        (category_id, year, month, amount, entry_type, project_id, source, updated_at)
      VALUES
        (v_cat_gu_return, v_gu_year, v_gu_month, v_total_gu, 'plan', p_project_id, 'dossier', now())
      ON CONFLICT (category_id, year, month, entry_type, project_id, source)
        DO UPDATE SET amount = EXCLUDED.amount, updated_at = now();
      v_inserted := v_inserted + 1;
    END IF;
  END IF;

  -- Плановые выплаты страхования — равномерно по 12 месяцам
  IF v_dossier.insurance_go_amount > 0 AND v_cat_insurance IS NOT NULL THEN
    v_monthly_insurance := ROUND(v_dossier.insurance_go_amount / 12.0, 2);
    FOR v_m IN 1..12 LOOP
      INSERT INTO bdds_entries
        (category_id, year, month, amount, entry_type, project_id, source, updated_at)
      VALUES
        (v_cat_insurance, p_year, v_m, v_monthly_insurance, 'plan', p_project_id, 'dossier', now())
      ON CONFLICT (category_id, year, month, entry_type, project_id, source)
        DO UPDATE SET amount = EXCLUDED.amount, updated_at = now();
      v_inserted := v_inserted + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'inserted',             v_inserted,
    'year',                 p_year,
    'lag_months',           v_lag_months,
    'total_gu_accumulated', v_total_gu
  );
END;
$$;

-- 6) bdds_get_contract_status — агрегированный статус-бар по договору
CREATE OR REPLACE FUNCTION bdds_get_contract_status(p_project_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_contract_amount NUMERIC := 0;
  v_advances        NUMERIC := 0;
  v_obs             NUMERIC := 0;
  v_works           NUMERIC := 0;
  v_gu_return       NUMERIC := 0;
BEGIN
  -- Сумма договора из досье
  SELECT COALESCE((header_data->>'contract_amount')::NUMERIC, 0)
  INTO v_contract_amount
  FROM contract_dossiers
  WHERE project_id = p_project_id AND is_active = true
  ORDER BY (CASE WHEN document_type = 'amendment' THEN 1 ELSE 0 END) DESC,
            document_date DESC NULLS LAST
  LIMIT 1;

  -- Факт: авансы р/с
  SELECT COALESCE(SUM(be.amount), 0) INTO v_advances
  FROM bdds_entries be
  JOIN bdds_categories bc ON bc.id = be.category_id
  WHERE be.project_id = p_project_id AND be.entry_type = 'fact'
    AND bc.name = 'Авансы от Заказчика (на обычный р/с)';

  -- Факт: поступления на ОБС
  SELECT COALESCE(SUM(be.amount), 0) INTO v_obs
  FROM bdds_entries be
  JOIN bdds_categories bc ON bc.id = be.category_id
  WHERE be.project_id = p_project_id AND be.entry_type = 'fact'
    AND bc.name = 'Поступления от Заказчика на ОБС';

  -- Факт: оплата за выполненные работы
  SELECT COALESCE(SUM(be.amount), 0) INTO v_works
  FROM bdds_entries be
  JOIN bdds_categories bc ON bc.id = be.category_id
  WHERE be.project_id = p_project_id AND be.entry_type = 'fact'
    AND bc.name = 'Оплата от Заказчика за выполненные работы (на обычный р/с)';

  -- Факт: возврат ГУ
  SELECT COALESCE(SUM(be.amount), 0) INTO v_gu_return
  FROM bdds_entries be
  JOIN bdds_categories bc ON bc.id = be.category_id
  WHERE be.project_id = p_project_id AND be.entry_type = 'fact'
    AND bc.name = 'Возврат гарантийных удержаний от Заказчика';

  RETURN jsonb_build_object(
    'contract_amount',    v_contract_amount,
    'advances_received',  v_advances + v_obs,
    'works_received',     v_works,
    'gu_returned',        v_gu_return,
    'total_received',     v_advances + v_obs + v_works + v_gu_return,
    'remaining',          GREATEST(0, v_contract_amount - v_advances - v_obs - v_works - v_gu_return)
  );
END;
$$;
