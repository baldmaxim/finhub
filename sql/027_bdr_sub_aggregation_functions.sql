-- RPC-функции агрегации bdr_sub_entries (обход лимита 1000 строк)

-- 1. Помесячные итоги по одному sub_type за год
CREATE OR REPLACE FUNCTION bdr_sub_totals_by_month(
  p_sub_type TEXT,
  p_year INT,
  p_project_id UUID DEFAULT NULL
)
RETURNS TABLE(month INT, total NUMERIC) AS $$
  SELECT
    EXTRACT(MONTH FROM entry_date)::INT AS month,
    SUM(CASE WHEN amount_without_nds IS NOT NULL AND amount_without_nds <> 0 THEN amount_without_nds ELSE amount END) AS total
  FROM bdr_sub_entries
  WHERE sub_type = p_sub_type
    AND entry_date >= (p_year || '-01-01')::DATE
    AND entry_date <= (p_year || '-12-31')::DATE
    AND (p_project_id IS NULL OR project_id = p_project_id)
  GROUP BY month
  ORDER BY month;
$$ LANGUAGE sql STABLE;

-- 2. Помесячные итоги по нескольким sub_type за год
CREATE OR REPLACE FUNCTION bdr_multi_sub_totals_by_month(
  p_sub_types TEXT[],
  p_year INT,
  p_project_id UUID DEFAULT NULL
)
RETURNS TABLE(sub_type TEXT, month INT, total NUMERIC) AS $$
  SELECT
    sub_type,
    EXTRACT(MONTH FROM entry_date)::INT AS month,
    SUM(CASE WHEN amount_without_nds IS NOT NULL AND amount_without_nds <> 0 THEN amount_without_nds ELSE amount END) AS total
  FROM bdr_sub_entries
  WHERE sub_type = ANY(p_sub_types)
    AND entry_date >= (p_year || '-01-01')::DATE
    AND entry_date <= (p_year || '-12-31')::DATE
    AND (p_project_id IS NULL OR project_id = p_project_id)
  GROUP BY sub_type, month
  ORDER BY sub_type, month;
$$ LANGUAGE sql STABLE;

-- 3. Помесячные итоги ОФЗ (fixed_expenses) за год
CREATE OR REPLACE FUNCTION bdr_fixed_expenses_by_month(
  p_year INT,
  p_project_id UUID DEFAULT NULL
)
RETURNS TABLE(month INT, total NUMERIC) AS $$
  SELECT
    EXTRACT(MONTH FROM entry_date)::INT AS month,
    SUM(
      CASE
        WHEN description IS NOT NULL AND description ~ '^\d+(\.\d+)?$' AND description::NUMERIC > 0
        THEN amount - (amount / description::NUMERIC)
        ELSE amount
      END
    ) AS total
  FROM bdr_sub_entries
  WHERE sub_type = 'fixed_expenses'
    AND entry_date >= (p_year || '-01-01')::DATE
    AND entry_date <= (p_year || '-12-31')::DATE
    AND (p_project_id IS NULL OR project_id = p_project_id)
  GROUP BY month
  ORDER BY month;
$$ LANGUAGE sql STABLE;
