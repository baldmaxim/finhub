-- 057: Производительность ETL — устраняем 500 (statement_timeout)
--
-- Что лечим:
--   1) etl_reroute_quarantine падает 500 на ~13 500+ карантинных строках
--      (etl_route_batch — построчный FOR-LOOP, N+1 запросов на строку,
--      легко уходит за дефолтный 8-секундный таймаут anon/authenticated).
--   2) /rest/v1/bank_account_balances 500 — view с 4 CTE-агрегатами
--      по всему etl_1c_entries (200 k+ строк) без поддержки индексами.
--   3) /rest/v1/etl_1c_entries?offset=125000+ 500 — глубокий offset =
--      full-scan + sort. Лечим индексом и keyset-пагинацией на клиенте.
--
-- План миграции:
--   A. Индексы под пагинацию, маршрутизацию и MV.
--   B. Set-based переписанный etl_route_batch (одной транзакцией, без LOOP).
--   C. statement_timeout 120–180 c для etl_route_batch / sync_bdds /
--      reroute_quarantine — страховка для редких больших батчей.
--   D. bank_account_balances и bank_account_balances_monthly →
--      MATERIALIZED VIEW + UNIQUE-индексы для REFRESH CONCURRENTLY.
--   E. refresh_bank_balances() и вызов из etl_sync_bdds, чтобы MV
--      обновлялись автоматически после каждого импорта/перемаршрутизации.

-- =============================================================
-- A. ИНДЕКСЫ
-- =============================================================

-- Пагинация PostgREST по статусу + сортировке по дате (карантин, pending)
CREATE INDEX IF NOT EXISTS idx_etl_entries_status_doc_date
  ON etl_1c_entries (status, doc_date DESC, id);

-- Keyset-пагинация без фильтра по статусу (полный список 200 k+)
CREATE INDEX IF NOT EXISTS idx_etl_entries_doc_date_id
  ON etl_1c_entries (doc_date DESC, id);

-- Set-based join из etl_route_batch (counterparty_name, contract_name)
-- — короткий частичный индекс по pending, чтобы не раздувать на 200 k.
CREATE INDEX IF NOT EXISTS idx_etl_entries_pending_keys
  ON etl_1c_entries (counterparty_name, contract_name)
  WHERE status = 'pending';

-- Поддержка bank_account_balances (фильтр по doc_type внутри bank_account_id)
CREATE INDEX IF NOT EXISTS idx_etl_entries_bank_doctype
  ON etl_1c_entries (bank_account_id, doc_type)
  WHERE bank_account_id IS NOT NULL;

-- =============================================================
-- B. SET-BASED etl_route_batch
-- =============================================================
-- Раньше: FOR v_entry IN ... LOOP { 4–5 SELECT/UPDATE на строку }.
-- Стало: один UPDATE с CTE-цепочкой, обрабатывает весь батч одной командой.
-- Логика идентична 042 (правила → regex fallback → contract_map → routed
-- либо quarantine), но без построчного цикла.

CREATE OR REPLACE FUNCTION etl_route_batch(p_batch_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_routed     INT := 0;
  v_quarantine INT := 0;
BEGIN
  WITH pending AS (
    SELECT
      e.id,
      e.doc_type,
      e.credit_account,
      e.counterparty_name,
      e.contract_name,
      e.document,
      e.payment_purpose,
      COALESCE(ba.is_obs, false) AS is_obs
    FROM etl_1c_entries e
    LEFT JOIN bank_accounts ba ON ba.id = e.bank_account_id
    WHERE e.import_batch_id = p_batch_id
      AND e.status = 'pending'
  ),
  -- Шаг 1: лучший подходящий routing-rule по приоритету (NULL = любое значение).
  rule_match AS (
    SELECT DISTINCT ON (p.id)
      p.id,
      r.category_id    AS rule_category_id,
      r.skip_bdds,
      r.priority       AS rule_priority,
      r.description    AS rule_description
    FROM pending p
    LEFT JOIN etl_routing_rules r
      ON r.is_active = true
     AND (r.match_doc_type           IS NULL OR r.match_doc_type = p.doc_type)
     AND (r.match_is_obs             IS NULL OR r.match_is_obs   = p.is_obs)
     AND (r.match_credit_subaccount  IS NULL
          OR (p.credit_account IS NOT NULL
              AND p.credit_account LIKE r.match_credit_subaccount || '%'))
    ORDER BY p.id, r.priority ASC NULLS LAST
  ),
  -- Шаг 2: regex-фолбэк по document + payment_purpose (только если правило
  -- категорию не дало и не помечено skip_bdds).
  regex_match AS (
    SELECT DISTINCT ON (p.id)
      p.id,
      pm.category_id AS regex_category_id
    FROM pending p
    LEFT JOIN rule_match rm ON rm.id = p.id
    LEFT JOIN etl_1c_payment_masks pm
      ON pm.is_active = true
     AND trim(regexp_replace(
           COALESCE(p.document, '') || ' ' || COALESCE(p.payment_purpose, ''),
           '\s+', ' ', 'g'
         )) ~* pm.pattern
    WHERE rm.rule_category_id IS NULL
      AND (rm.skip_bdds IS NULL OR rm.skip_bdds = false)
    ORDER BY p.id, pm.priority ASC NULLS LAST
  ),
  -- Шаг 3: проект из contract_map.
  contract AS (
    SELECT
      p.id,
      cm.project_id
    FROM pending p
    LEFT JOIN etl_1c_contract_map cm
      ON cm.counterparty_name = p.counterparty_name
     AND cm.contract_name     = p.contract_name
  ),
  combined AS (
    SELECT
      p.id,
      rm.skip_bdds,
      rm.rule_category_id,
      rm.rule_priority,
      rm.rule_description,
      reg.regex_category_id,
      c.project_id,
      CASE
        WHEN rm.skip_bdds = true                THEN 'rule'
        WHEN rm.rule_category_id IS NOT NULL    THEN 'rule'
        WHEN reg.regex_category_id IS NOT NULL  THEN 'regex'
        ELSE NULL
      END AS final_method,
      CASE
        WHEN rm.skip_bdds = true OR rm.rule_category_id IS NOT NULL
          THEN COALESCE(rm.rule_description, 'rule:' || rm.rule_priority::text)
        WHEN reg.regex_category_id IS NOT NULL
          THEN 'category by regex (fallback)'
        ELSE NULL
      END AS final_log,
      CASE
        WHEN rm.skip_bdds = true               THEN NULL
        WHEN rm.rule_category_id IS NOT NULL   THEN rm.rule_category_id
        WHEN reg.regex_category_id IS NOT NULL THEN reg.regex_category_id
        ELSE NULL
      END AS final_category
    FROM pending p
    LEFT JOIN rule_match  rm  ON rm.id  = p.id
    LEFT JOIN regex_match reg ON reg.id = p.id
    LEFT JOIN contract    c   ON c.id   = p.id
  ),
  upd AS (
    UPDATE etl_1c_entries e
    SET status = CASE
                   WHEN c.skip_bdds = true                                       THEN 'routed'
                   WHEN c.final_category IS NULL                                 THEN 'quarantine'
                   WHEN c.project_id IS NULL                                     THEN 'quarantine'
                   ELSE 'routed'
                 END,
        routed_project_id  = CASE
                               WHEN c.skip_bdds = true            THEN NULL
                               WHEN c.final_category IS NULL      THEN NULL
                               WHEN c.project_id IS NULL          THEN NULL
                               ELSE c.project_id
                             END,
        routed_category_id = CASE
                               WHEN c.skip_bdds = true            THEN NULL
                               WHEN c.final_category IS NULL      THEN NULL
                               WHEN c.project_id IS NULL          THEN NULL
                               ELSE c.final_category
                             END,
        route_method = CASE
                         WHEN c.skip_bdds = true                  THEN 'rule'
                         WHEN c.final_category IS NULL            THEN NULL
                         WHEN c.project_id IS NULL                THEN NULL
                         ELSE c.final_method
                       END,
        route_log = CASE
                      WHEN c.skip_bdds = true                     THEN c.final_log
                      WHEN c.final_category IS NULL               THEN 'no matching rule or regex'
                      WHEN c.project_id IS NULL                   THEN 'no contract mapping'
                      ELSE c.final_log
                    END,
        routed_at = CASE
                      WHEN c.skip_bdds = true                                          THEN now()
                      WHEN c.final_category IS NOT NULL AND c.project_id IS NOT NULL  THEN now()
                      ELSE NULL
                    END,
        updated_at = now()
    FROM combined c
    WHERE e.id = c.id
    RETURNING e.status
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
-- C. statement_timeout — страховка для больших батчей
-- =============================================================
ALTER FUNCTION etl_route_batch(uuid)        SET statement_timeout = '120s';
ALTER FUNCTION etl_sync_bdds()              SET statement_timeout = '120s';
ALTER FUNCTION etl_reroute_quarantine()     SET statement_timeout = '180s';

-- =============================================================
-- D. bank_account_balances → MATERIALIZED VIEW
-- =============================================================
-- Schema совместима с 056 (id, account_number, ..., balance, last_operation_date).
-- Сначала сносим старый VIEW (если миграция применяется поверх 056), затем
-- (на повторном запуске) — старую MATERIALIZED VIEW.

DROP VIEW              IF EXISTS bank_account_balances;
DROP MATERIALIZED VIEW IF EXISTS bank_account_balances;

CREATE MATERIALIZED VIEW bank_account_balances AS
WITH
inflows AS (
  SELECT bank_account_id AS account_id, SUM(amount) AS total
    FROM etl_1c_entries
   WHERE bank_account_id IS NOT NULL
     AND doc_type IN ('receipt', 'debt_correction')
   GROUP BY bank_account_id
),
expenses AS (
  SELECT bank_account_id AS account_id, SUM(amount) AS total
    FROM etl_1c_entries
   WHERE bank_account_id IS NOT NULL
     AND doc_type = 'expense'
   GROUP BY bank_account_id
),
transfers_in AS (
  SELECT e.bank_account_id AS account_id, SUM(e.amount) AS total
    FROM etl_1c_entries e
    JOIN bank_accounts ba ON ba.id = e.bank_account_id
   WHERE e.doc_type = 'internal_transfer'
     AND e.analytics_dt LIKE ba.account_number || '%'
   GROUP BY e.bank_account_id
),
transfers_out AS (
  SELECT e.bank_account_id AS account_id, SUM(e.amount) AS total
    FROM etl_1c_entries e
    JOIN bank_accounts ba ON ba.id = e.bank_account_id
   WHERE e.doc_type = 'internal_transfer'
     AND e.analytics_kt LIKE ba.account_number || '%'
   GROUP BY e.bank_account_id
),
last_op AS (
  SELECT bank_account_id AS account_id, MAX(doc_date) AS last_date
    FROM etl_1c_entries
   WHERE bank_account_id IS NOT NULL
   GROUP BY bank_account_id
)
SELECT
  ba.id,
  ba.account_number,
  ba.bank_name,
  ba.bik,
  ba.description,
  ba.is_active,
  ba.opening_balance,
  ba.opening_date,
  COALESCE(i.total, 0)    AS inflows,
  COALESCE(ex.total, 0)   AS expenses,
  COALESCE(ti.total, 0)   AS transfers_in,
  COALESCE(tout.total, 0) AS transfers_out,
  ba.opening_balance
    + COALESCE(i.total, 0)
    - COALESCE(ex.total, 0)
    + COALESCE(ti.total, 0)
    - COALESCE(tout.total, 0) AS balance,
  COALESCE(lo.last_date, ba.opening_date) AS last_operation_date
FROM bank_accounts ba
LEFT JOIN inflows       i    ON i.account_id    = ba.id
LEFT JOIN expenses      ex   ON ex.account_id   = ba.id
LEFT JOIN transfers_in  ti   ON ti.account_id   = ba.id
LEFT JOIN transfers_out tout ON tout.account_id = ba.id
LEFT JOIN last_op       lo   ON lo.account_id   = ba.id
WHERE ba.is_active = true;

-- UNIQUE-индекс обязателен для REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS bank_account_balances_pk
  ON bank_account_balances (id);

-- PostgREST читает MV под ролями anon/authenticated.
GRANT SELECT ON bank_account_balances TO anon, authenticated;

-- ---- bank_account_balances_monthly → MATERIALIZED VIEW ----
DROP VIEW              IF EXISTS bank_account_balances_monthly;
DROP MATERIALIZED VIEW IF EXISTS bank_account_balances_monthly;

CREATE MATERIALIZED VIEW bank_account_balances_monthly AS
WITH months AS (
  SELECT
    ba.id             AS account_id,
    ba.account_number,
    ba.opening_balance,
    date_trunc('month', e.doc_date)::date AS month_start,
    SUM(e.amount) FILTER (WHERE e.doc_type IN ('receipt','debt_correction'))                                       AS inflows,
    SUM(e.amount) FILTER (WHERE e.doc_type = 'expense')                                                            AS expenses,
    SUM(e.amount) FILTER (WHERE e.doc_type = 'internal_transfer' AND e.analytics_dt LIKE ba.account_number || '%') AS transfers_in,
    SUM(e.amount) FILTER (WHERE e.doc_type = 'internal_transfer' AND e.analytics_kt LIKE ba.account_number || '%') AS transfers_out
  FROM bank_accounts ba
  JOIN etl_1c_entries e ON e.bank_account_id = ba.id
  WHERE ba.is_active = true
  GROUP BY ba.id, ba.account_number, ba.opening_balance, date_trunc('month', e.doc_date)
)
SELECT
  account_id,
  account_number,
  to_char(month_start, 'YYYY-MM') AS month,
  month_start,
  COALESCE(inflows, 0)       AS inflows,
  COALESCE(expenses, 0)      AS expenses,
  COALESCE(transfers_in, 0)  AS transfers_in,
  COALESCE(transfers_out, 0) AS transfers_out,
  COALESCE(inflows, 0)
    - COALESCE(expenses, 0)
    + COALESCE(transfers_in, 0)
    - COALESCE(transfers_out, 0) AS month_delta,
  opening_balance
    + SUM(
        COALESCE(inflows, 0)
          - COALESCE(expenses, 0)
          + COALESCE(transfers_in, 0)
          - COALESCE(transfers_out, 0)
      ) OVER (PARTITION BY account_id ORDER BY month_start) AS running_balance
FROM months;

CREATE UNIQUE INDEX IF NOT EXISTS bank_account_balances_monthly_pk
  ON bank_account_balances_monthly (account_id, month_start);

GRANT SELECT ON bank_account_balances_monthly TO anon, authenticated;

-- =============================================================
-- E. refresh_bank_balances() и вызов из etl_sync_bdds
-- =============================================================

CREATE OR REPLACE FUNCTION refresh_bank_balances()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- CONCURRENTLY = без блокировки читателей. Требует UNIQUE-индекс,
  -- который мы создали выше.
  REFRESH MATERIALIZED VIEW CONCURRENTLY bank_account_balances;
  REFRESH MATERIALIZED VIEW CONCURRENTLY bank_account_balances_monthly;
END;
$$;

ALTER FUNCTION refresh_bank_balances() SET statement_timeout = '180s';

GRANT EXECUTE ON FUNCTION refresh_bank_balances() TO anon, authenticated;

-- Расширяем etl_sync_bdds: после пересчёта фактов БДДС — обновляем MV.
-- Сама бизнес-логика sync (DELETE source='etl' + INSERT агрегатов) не меняется,
-- берём её из 042 как есть и добавляем PERFORM refresh_bank_balances().

CREATE OR REPLACE FUNCTION etl_sync_bdds()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted        INT;
  v_inserted       INT := 0;
  v_rows           INT;
  v_income_cat_id  UUID;
  v_expense_cat_id UUID;
BEGIN
  SELECT id INTO v_income_cat_id  FROM bdds_categories WHERE name = 'Оплата по распред. письмам (РП)' LIMIT 1;
  SELECT id INTO v_expense_cat_id FROM bdds_categories WHERE name = 'Субподряд: оплата по РП'         LIMIT 1;

  DELETE FROM bdds_entries WHERE source = 'etl';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

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

  -- Авто-обновление MV остатков по р/с.
  PERFORM refresh_bank_balances();

  RETURN jsonb_build_object('deleted', v_deleted, 'inserted', v_inserted);
END;
$$;

-- Первичная инициализация MV (после CREATE MATERIALIZED VIEW они уже
-- содержат текущий снимок данных, но прогон ещё раз — гарантия консистентности).
SELECT refresh_bank_balances();

-- Перечитать схему PostgREST (на случай Supabase кешей роутинга).
NOTIFY pgrst, 'reload schema';
