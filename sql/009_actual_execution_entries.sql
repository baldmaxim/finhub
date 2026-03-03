-- Таблица фактического выполнения по проектам
CREATE TABLE actual_execution_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  month_key VARCHAR(7) NOT NULL, -- формат "YYYY-MM"
  ks_amount NUMERIC DEFAULT 0, -- Выполнено по КС (подписано)
  fact_amount NUMERIC DEFAULT 0, -- Выполнение фактическое
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, month_key)
);

-- RLS
ALTER TABLE actual_execution_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "actual_execution_entries_all" ON actual_execution_entries
  FOR ALL USING (true) WITH CHECK (true);
