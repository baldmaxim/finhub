-- 057: Производительность шлюза 1С — set-based маршрутизация, индексы, statement_timeout
--
-- Контекст: на больших объёмах (200k+ etl_1c_entries, 13k+ карантин) HTTP-вызовы
-- /rpc/etl_reroute_quarantine, GET /etl_1c_entries?offset=125000+, /bank_account_balances
-- стабильно возвращали 500 (statement timeout). Корни:
--   1) etl_route_batch построчно (FOR ... LOOP) с N+1 SELECT/UPDATE — на 13k строк
--      это тысячи мини-запросов в одной транзакции, упирается в 8s default-timeout.
--   2) Глубокая offset-пагинация по etl_1c_entries без подходящих индексов —
--      каждый GET с offset=200000 заново сканирует первые 200k строк.
--   3) View bank_account_balances выполняет 4 GROUP BY-агрегата по всему
--      etl_1c_entries без индекса (bank_account_id, doc_type).
--
-- Решение:
--   * set-based etl_route_batch одним UPDATE FROM CTE (без LOOP);
--   * индексы под пагинацию (status, doc_date, id), под view (bank_account_id, doc_type),
--     под маршрутизацию pending-записей батча;
--   * завышенный statement_timeout на тяжёлых функциях.
-- Keyset-пагинация на клиенте — отдельная правка (etlService.ts).

-- =========================================================
-- 1) Индексы
-- =========================================================

-- Пагинация по статусу + сортировка по дате убыванию (карантин-таб, общий список)
CREATE INDEX IF NOT EXISTS idx_etl_entries_status_doc_date
  ON etl_1c_entries (status, doc_date DESC, id DESC);

-- Keyset-пагинация без фильтра статуса (offset=125000+ заменяется на cursor)
CREATE INDEX IF NOT EXISTS idx_etl_entries_doc_date_id
  ON etl_1c_entries (doc_date DESC, id DESC);

-- View bank_account_balances и _monthly: агрегация по (bank_account_id, doc_type)
CREATE INDEX IF NOT EXISTS idx_etl_entries_bank_doctype
  ON etl_1c_entries (bank_account_id, doc_type)
  WHERE bank_account_id IS NOT NULL;

-- Маршрутизация: быстрый поиск pending записей внутри батча
CREATE INDEX IF NOT EXISTS idx_etl_entries_pending_batch
  ON etl_1c_entries (import_batch_id)
  WHERE status = 'pending';

-- =========================================================
-- 2) Set-based etl_route_batch (одна транзакция, без LOOP)
--
-- Логика идентична версии из 042 (042_routing_rules_batch.sql):
--   шаг 1: первое подходящее etl_routing_rules по приоритету ASC;
--   шаг 1a: если skip_bdds=true → routed без category/project (внутр. перевод);
--   шаг 2: если правило без категории — fallback regex по etl_1c_payment_masks;
--   шаг 3: если категории нет → quarantine 'no matching rule or regex';
--   шаг 4: проект ищется по etl_1c_contract_map; если нет → quarantine 'no contract mapping';
--   шаг 5: иначе routed с заполнением project/category/method/log.
-- =========================================================

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
  -- Первое подходящее структурное правило (по priority ASC) для каждой записи
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
    ORDER BY p.id, r.priority ASC
  ),
  -- Regex-fallback срабатывает только если правило не дало ни skip_bdds, ни категории
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

-- =========================================================
-- 3) Расширяем statement_timeout у тяжёлых функций
--    (etl_sync_bdds: DELETE+3 INSERT...SELECT по 200k строк;
--     etl_reroute_quarantine: UPDATE 13k строк + route + sync.)
-- =========================================================

ALTER FUNCTION etl_sync_bdds()          SET statement_timeout = '120s';
ALTER FUNCTION etl_reroute_quarantine() SET statement_timeout = '180s';
