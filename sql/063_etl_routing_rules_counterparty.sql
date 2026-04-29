-- 063: Маршрутизация по контрагенту — банки, зарплата, приставы.
--
-- Что делаем:
--   1) Добавляем в etl_routing_rules колонку match_counterparty_pattern
--      (regex по counterparty_name; NULL = не проверять).
--   2) Обновляем etl_route_batch — в условие rule_match добавляем
--      проверку этого паттерна.
--   3) Заводим 3 правила со skip_bdds=true (приоритет 5/6/7 — выше
--      существующих 10/20/...). Эти проводки уйдут из карантина без
--      привязки к проекту, в БДДС не попадут.
--
-- После выката: «Перемаршрутизация» в портале → ~300 строк уйдут
-- из карантина (банки + зарплата + приставы).

-- =============================================================
-- 1) Колонка match_counterparty_pattern
-- =============================================================
ALTER TABLE etl_routing_rules
  ADD COLUMN IF NOT EXISTS match_counterparty_pattern TEXT;

COMMENT ON COLUMN etl_routing_rules.match_counterparty_pattern IS
  'POSIX regex по counterparty_name. NULL = не проверять. Пример: ^БАНК ВТБ';

-- =============================================================
-- 2) Обновлённая etl_route_batch (добавлено условие на counterparty)
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
      r.priority    AS rule_priority,
      r.category_id AS rule_category_id,
      r.skip_bdds   AS rule_skip_bdds,
      r.description AS rule_desc
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
    SELECT r.*, cm.project_id
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
-- 3) Три правила со skip_bdds=true
-- =============================================================

-- П-5: Банки (комиссии, переводы внутри банка, обслуживание счёта)
INSERT INTO etl_routing_rules
  (priority, match_counterparty_pattern, skip_bdds, is_active, description)
VALUES
  (5,
   '^(БАНК ВТБ|МОСКОВСКИЙ КРЕДИТНЫЙ БАНК|АРЕСБАНК|СБЕРБАНК|АЛЬФА-БАНК|ГАЗПРОМБАНК|ОТКРЫТИЕ|РАЙФФАЙЗЕН|ТИНЬКОФФ|ПОЧТА БАНК|ЮНИКРЕДИТ|РОСБАНК|ПСБ|ПРОМСВЯЗЬБАНК|РОССЕЛЬХОЗБАНК)',
   true, true,
   'Банки — не в БДДС (комиссии, обслуживание, внутренние переводы)')
ON CONFLICT (priority) DO UPDATE SET
  match_counterparty_pattern = EXCLUDED.match_counterparty_pattern,
  skip_bdds                  = EXCLUDED.skip_bdds,
  is_active                  = EXCLUDED.is_active,
  description                = EXCLUDED.description,
  updated_at                 = now();

-- П-6: Оплата труда — не в БДДС проектов
INSERT INTO etl_routing_rules
  (priority, match_counterparty_pattern, skip_bdds, is_active, description)
VALUES
  (6,
   '^Оплата труда',
   true, true,
   'Оплата труда — не в БДДС проектов (учёт ЗП в отдельном модуле)')
ON CONFLICT (priority) DO UPDATE SET
  match_counterparty_pattern = EXCLUDED.match_counterparty_pattern,
  skip_bdds                  = EXCLUDED.skip_bdds,
  is_active                  = EXCLUDED.is_active,
  description                = EXCLUDED.description,
  updated_at                 = now();

-- П-7: ФССП (приставы) — удержания, не в БДДС
INSERT INTO etl_routing_rules
  (priority, match_counterparty_pattern, skip_bdds, is_active, description)
VALUES
  (7,
   '(?i)(ФССП|приставов)',
   true, true,
   'Приставы (ФССП) — удержания, не в БДДС')
ON CONFLICT (priority) DO UPDATE SET
  match_counterparty_pattern = EXCLUDED.match_counterparty_pattern,
  skip_bdds                  = EXCLUDED.skip_bdds,
  is_active                  = EXCLUDED.is_active,
  description                = EXCLUDED.description,
  updated_at                 = now();

NOTIFY pgrst, 'reload schema';
