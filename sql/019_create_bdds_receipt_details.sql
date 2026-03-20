-- Таблица детальных поступлений от продажи продукции
-- Импортируется из Excel: №п/п, Дата, Заказчик, Договор, Проект, Сумма
CREATE TABLE bdds_receipt_details (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES bdds_categories(id) ON DELETE CASCADE,
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  row_number int,
  receipt_date date,
  customer text NOT NULL DEFAULT '',
  contract text NOT NULL DEFAULT '',
  project_name text NOT NULL DEFAULT '',
  amount numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Индекс для быстрой выборки по проекту и году
CREATE INDEX idx_bdds_receipt_details_project_year
  ON bdds_receipt_details(project_id, year);

-- RLS
ALTER TABLE bdds_receipt_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated"
  ON bdds_receipt_details
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
