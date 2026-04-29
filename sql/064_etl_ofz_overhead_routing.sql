-- 064: Раздел ОФЗ в БДДС + общехоз-проект + правила маршрутизации.
--
-- Что делаем:
--   1) Создаём проект «Общехоз СУ-10» (code=OBSCHEHOZ).
--   2) В bdds_categories добавляем родителя «Постоянные коммерческие и
--      управленческие расходы (ОФЗ)» (operating/overhead, parent_id=NULL,
--      sum_children) и 2 дочерних категории (банковские, удержания).
--      ФОТ исключён — он будет распределяться по проектам отдельно.
--   3) Расширяем etl_routing_rules колонкой default_project_id —
--      проект-фоллбэк, когда (counterparty, contract) нет в etl_1c_contract_map.
--   4) Обновляем etl_route_batch: проект берём из contract_map,
--      если его нет — из rule.default_project_id.
--   5) Перезаписываем 2 правила (приоритеты 5/7): вместо skip_bdds=true
--      теперь category_id + default_project_id → проводки идут в БДДС
--      проекта «Общехоз СУ-10» в новый раздел ОФЗ.
--   6) Удаляем правило П-6 (Оплата труда), оставленное миграцией 063 —
--      ФОТ остаётся в карантине до отдельной логики разнесения по проектам.
--
-- После применения: «Перемаршрутизация» в портале → банки и приставы
-- из карантина уйдут в ОФЗ общехоз-проекта. ФОТ остаётся в карантине.

-- =============================================================
-- 1) Проект «Общехоз СУ-10»
-- =============================================================
INSERT INTO projects (code, name, related_names, description, is_active)
VALUES (
  'OBSCHEHOZ',
  'Общехоз СУ-10',
  'Общехоз;Накладные;ОФЗ',
  'Технический проект для общехозяйственных расходов: банковские комиссии, ФОТ управления, удержания по ИЛ',
  true
)
ON CONFLICT (code) DO UPDATE SET
  is_active = true,
  updated_at = now();

-- =============================================================
-- 2) Раздел ОФЗ в БДДС: родитель + 3 дочерние
-- =============================================================

-- 2.1 Родитель: «Постоянные коммерческие и управленческие расходы (ОФЗ)»
INSERT INTO bdds_categories
  (section_code, row_type, name, sort_order, is_calculated, calculation_formula, parent_id)
SELECT
  'operating',
  'overhead',
  'Постоянные коммерческие и управленческие расходы (ОФЗ)',
  900,        -- большой sort_order, чтобы шёл в конце operating-раздела
  true,
  'sum_children',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM bdds_categories
   WHERE name = 'Постоянные коммерческие и управленческие расходы (ОФЗ)'
     AND section_code = 'operating'
);

-- 2.2 Дочерние категории (ФОТ исключён — будет разнесён по проектам отдельно)
INSERT INTO bdds_categories (section_code, row_type, name, sort_order, is_calculated, parent_id)
SELECT 'operating', 'overhead', child.name, child.sort_order, false, parent.id
FROM bdds_categories parent,
(VALUES
  ('Банковские расходы (комиссии, обслуживание)', 1),
  ('Удержания по исполнительным листам',          2)
) AS child(name, sort_order)
WHERE parent.name = 'Постоянные коммерческие и управленческие расходы (ОФЗ)'
  AND parent.section_code = 'operating'
  AND parent.parent_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM bdds_categories c
     WHERE c.name = child.name
       AND c.section_code = 'operating'
  );

-- =============================================================
-- 3) Колонка default_project_id в etl_routing_rules
-- =============================================================
ALTER TABLE etl_routing_rules
  ADD COLUMN IF NOT EXISTS default_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

COMMENT ON COLUMN etl_routing_rules.default_project_id IS
  'Проект-фоллбэк, если пары (counterparty, contract) нет в etl_1c_contract_map.';

-- =============================================================
-- 4) Обновлённая etl_route_batch
--    (проект: contract_map → если нет, default_project_id из правила)
-- =============================================================
CREATE OR REPLACE FUNCTION etl_route_batch(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SET statement_timeout = '120s'
AS $$
DECLARE
  v_routed     INT := 0;
  v_quarantine INT := 0;
BEGIN
  WITH
  pending AS (
    SELECT
      e.id,
      e.doc_type,
      e.credit_account,
      e.document,
      e.payment_purpose,
      e.counterparty_name,
      e.contract_name,
      COALESCE(ba.is_obs, false) AS is_obs
    FROM etl_1c_entries e
    LEFT JOIN bank_accounts ba ON ba.id = e.bank_account_id
    WHERE e.import_batch_id = p_batch_id
      AND e.status = 'pending'
  ),
  rule_match AS (
    SELECT DISTINCT ON (p.id)
      p.id,
      r.priority           AS rule_priority,
      r.category_id        AS rule_category_id,
      r.default_project_id AS rule_default_project_id,
      r.skip_bdds          AS rule_skip_bdds,
      r.description        AS rule_desc
    FROM pending p
    JOIN etl_routing_rules r
      ON r.is_active = true
     AND (r.match_doc_type IS NULL OR r.match_doc_type = p.doc_type)
     AND (r.match_is_obs   IS NULL OR r.match_is_obs   = p.is_obs)
     AND (
           r.match_credit_subaccount IS NULL
        OR (p.credit_account IS NOT NULL
            AND p.credit_account LIKE r.match_credit_subaccount || '%')
         )
     AND (
           r.match_counterparty_pattern IS NULL
        OR (p.counterparty_name IS NOT NULL
            AND p.counterparty_name ~* r.match_counterparty_pattern)
         )
    ORDER BY p.id, r.priority ASC
  ),
  regex_match AS (
    SELECT DISTINCT ON (p.id)
      p.id,
      pm.category_id AS regex_category_id
    FROM pending p
    LEFT JOIN rule_match rm ON rm.id = p.id
    JOIN etl_1c_payment_masks pm
      ON pm.is_active = true
    WHERE COALESCE(rm.rule_skip_bdds, false) = false
      AND rm.rule_category_id IS NULL
      AND trim(regexp_replace(
            COALESCE(p.document, '') || ' ' || COALESCE(p.payment_purpose, ''),
            '\s+', ' ', 'g'
          )) ~* pm.pattern
    ORDER BY p.id, pm.priority ASC
  ),
  resolved AS (
    SELECT
      p.id,
      p.counterparty_name,
      p.contract_name,
      rm.rule_skip_bdds,
      rm.rule_default_project_id,
      CASE
        WHEN rm.rule_skip_bdds = true          THEN NULL
        WHEN rm.rule_category_id IS NOT NULL   THEN rm.rule_category_id
        WHEN reg.regex_category_id IS NOT NULL THEN reg.regex_category_id
      END AS final_category,
      CASE
        WHEN rm.rule_skip_bdds = true OR rm.rule_category_id IS NOT NULL THEN 'rule'
        WHEN reg.regex_category_id IS NOT NULL                           THEN 'regex'
      END AS final_method,
      CASE
        WHEN rm.rule_skip_bdds = true OR rm.rule_category_id IS NOT NULL
          THEN COALESCE(rm.rule_desc, 'rule:' || rm.rule_priority::TEXT)
        WHEN reg.regex_category_id IS NOT NULL
          THEN 'category by regex (fallback)'
      END AS final_log
    FROM pending p
    LEFT JOIN rule_match  rm  ON rm.id  = p.id
    LEFT JOIN regex_match reg ON reg.id = p.id
  ),
  with_project AS (
    SELECT
      r.*,
      COALESCE(cm.project_id, r.rule_default_project_id) AS project_id
    FROM resolved r
    LEFT JOIN etl_1c_contract_map cm
      ON cm.counterparty_name = r.counterparty_name
     AND cm.contract_name     = r.contract_name
  ),
  upd AS (
    UPDATE etl_1c_entries e
    SET
      status = CASE
        WHEN wp.rule_skip_bdds = true     THEN 'routed'
        WHEN wp.final_category IS NULL    THEN 'quarantine'
        WHEN wp.project_id     IS NULL    THEN 'quarantine'
        ELSE 'routed'
      END,
      routed_project_id = CASE
        WHEN wp.rule_skip_bdds = true     THEN NULL
        WHEN wp.final_category IS NULL    THEN NULL
        ELSE wp.project_id
      END,
      routed_category_id = CASE
        WHEN wp.rule_skip_bdds = true     THEN NULL
        WHEN wp.final_category IS NULL    THEN NULL
        WHEN wp.project_id     IS NULL    THEN NULL
        ELSE wp.final_category
      END,
      route_method = CASE
        WHEN wp.rule_skip_bdds = true     THEN 'rule'
        WHEN wp.final_category IS NULL    THEN NULL
        WHEN wp.project_id     IS NULL    THEN NULL
        ELSE wp.final_method
      END,
      route_log = CASE
        WHEN wp.rule_skip_bdds = true     THEN COALESCE(wp.final_log, 'rule')
        WHEN wp.final_category IS NULL    THEN 'no matching rule or regex'
        WHEN wp.project_id     IS NULL    THEN 'no contract mapping'
        ELSE wp.final_log
      END,
      routed_at = CASE
        WHEN wp.rule_skip_bdds = true                                       THEN now()
        WHEN wp.final_category IS NOT NULL AND wp.project_id IS NOT NULL    THEN now()
        ELSE NULL
      END,
      updated_at = now()
    FROM with_project wp
    WHERE e.id = wp.id
    RETURNING e.id, e.status
  )
  SELECT
    COUNT(*) FILTER (WHERE status = 'routed'),
    COUNT(*) FILTER (WHERE status = 'quarantine')
  INTO v_routed, v_quarantine
  FROM upd;

  RETURN jsonb_build_object('routed', v_routed, 'quarantine', v_quarantine);
END;
$$;

-- =============================================================
-- 5) Правила: skip_bdds=true → category + default_project
--    (ФОТ-правило приоритет 6 удаляется — см. секцию 6)
-- =============================================================

-- П-5: Банки → Банковские расходы / Общехоз СУ-10
INSERT INTO etl_routing_rules
  (priority, match_counterparty_pattern, category_id, default_project_id,
   skip_bdds, is_active, description)
SELECT
  5,
  '^(БАНК ВТБ|МОСКОВСКИЙ КРЕДИТНЫЙ БАНК|АРЕСБАНК|СБЕРБАНК|АЛЬФА-БАНК|ГАЗПРОМБАНК|ОТКРЫТИЕ|РАЙФФАЙЗЕН|ТИНЬКОФФ|ПОЧТА БАНК|ЮНИКРЕДИТ|РОСБАНК|ПСБ|ПРОМСВЯЗЬБАНК|РОССЕЛЬХОЗБАНК)',
  cat.id,
  prj.id,
  false, true,
  'Банки → ОФЗ: Банковские расходы (Общехоз СУ-10)'
FROM bdds_categories cat
CROSS JOIN projects prj
WHERE cat.name = 'Банковские расходы (комиссии, обслуживание)'
  AND cat.section_code = 'operating'
  AND prj.code = 'OBSCHEHOZ'
ON CONFLICT (priority) DO UPDATE SET
  match_counterparty_pattern = EXCLUDED.match_counterparty_pattern,
  category_id                = EXCLUDED.category_id,
  default_project_id         = EXCLUDED.default_project_id,
  skip_bdds                  = false,
  is_active                  = true,
  description                = EXCLUDED.description,
  updated_at                 = now();

-- П-7: ФССП → Удержания по ИЛ / Общехоз СУ-10
INSERT INTO etl_routing_rules
  (priority, match_counterparty_pattern, category_id, default_project_id,
   skip_bdds, is_active, description)
SELECT
  7,
  '(?i)(ФССП|приставов)',
  cat.id,
  prj.id,
  false, true,
  'ФССП → ОФЗ: Удержания по исполнительным листам (Общехоз СУ-10)'
FROM bdds_categories cat
CROSS JOIN projects prj
WHERE cat.name = 'Удержания по исполнительным листам'
  AND cat.section_code = 'operating'
  AND prj.code = 'OBSCHEHOZ'
ON CONFLICT (priority) DO UPDATE SET
  match_counterparty_pattern = EXCLUDED.match_counterparty_pattern,
  category_id                = EXCLUDED.category_id,
  default_project_id         = EXCLUDED.default_project_id,
  skip_bdds                  = false,
  is_active                  = true,
  description                = EXCLUDED.description,
  updated_at                 = now();

-- =============================================================
-- 6) Удаляем правило П-6 (Оплата труда → skip_bdds), добавленное миграцией 063.
--    ФОТ остаётся в карантине — будет разнесён по проектам отдельной логикой.
-- =============================================================
DELETE FROM etl_routing_rules WHERE priority = 6;

NOTIFY pgrst, 'reload schema';
