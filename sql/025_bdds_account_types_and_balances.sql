-- =============================================================
-- 025: Разделение денежных потоков по типам счетов (р/с vs ОБС)
-- + строки остатков (Остаток на начало / на конец)
-- Идемпотентная миграция (безопасно перезапускать)
-- =============================================================

-- 1) Удаляем старые дочерние строки доходов (кроме новых 5)
DELETE FROM bdds_categories
WHERE parent_id = (
  SELECT id FROM bdds_categories
  WHERE name = 'Поступление средств от текущей деятельности'
    AND section_code = 'operating'
    AND row_type = 'income'
)
AND name NOT IN (
  'Авансы от Заказчика (на обычный р/с)',
  'Поступления от Заказчика на ОБС',
  'Оплата от Заказчика за выполненные работы (на обычный р/с)',
  'Оплата по распред. письмам (РП)',
  'Возврат гарантийных удержаний от Заказчика'
);

-- 2) Вставляем новые 5 дочерних строк доходов (если ещё нет)
INSERT INTO bdds_categories (section_code, row_type, name, sort_order, is_calculated, parent_id)
SELECT 'operating', 'income', child.name, child.sort_order, false, parent.id
FROM bdds_categories parent,
(VALUES
  ('Авансы от Заказчика (на обычный р/с)', 1),
  ('Поступления от Заказчика на ОБС', 2),
  ('Оплата от Заказчика за выполненные работы (на обычный р/с)', 3),
  ('Оплата по распред. письмам (РП)', 4),
  ('Возврат гарантийных удержаний от Заказчика', 5)
) AS child(name, sort_order)
WHERE parent.name = 'Поступление средств от текущей деятельности'
  AND parent.section_code = 'operating'
  AND parent.row_type = 'income'
  AND NOT EXISTS (
    SELECT 1 FROM bdds_categories bc
    WHERE bc.name = child.name AND bc.parent_id = parent.id
  );

-- 3) Добавляем строку «Субподряд: оплата по РП» в расходы
INSERT INTO bdds_categories (section_code, row_type, name, sort_order, is_calculated, parent_id)
SELECT 'operating', 'expense', 'Субподряд: оплата по РП', 6, false, parent.id
FROM bdds_categories parent
WHERE parent.name = 'Выплата средств по текущей деятельности'
  AND parent.section_code = 'operating'
  AND parent.row_type = 'expense'
  AND NOT EXISTS (
    SELECT 1 FROM bdds_categories bc
    WHERE bc.name = 'Субподряд: оплата по РП' AND bc.parent_id = parent.id
  );

-- 4) Расширяем CHECK constraint на row_type
ALTER TABLE bdds_categories DROP CONSTRAINT IF EXISTS bdds_categories_row_type_check;
ALTER TABLE bdds_categories ADD CONSTRAINT bdds_categories_row_type_check
  CHECK (row_type IN ('income', 'expense', 'overhead', 'net_cash_flow', 'balance_open', 'balance_close'));

-- 4a) Остаток на начало периода
INSERT INTO bdds_categories (section_code, row_type, name, sort_order, is_calculated, calculation_formula)
SELECT 'operating', 'balance_open', 'Остаток денежных средств на начало периода', 0, true, 'sum_children'
WHERE NOT EXISTS (
  SELECT 1 FROM bdds_categories
  WHERE name = 'Остаток денежных средств на начало периода' AND row_type = 'balance_open'
);

INSERT INTO bdds_categories (section_code, row_type, name, sort_order, is_calculated, parent_id)
SELECT 'operating', 'balance_open', child.name, child.sort_order, false, parent.id
FROM bdds_categories parent,
(VALUES
  ('Остаток на расчётных счетах (Свободный кэш)', 1),
  ('Остаток на ОБС (Заблокированный/Целевой кэш)', 2)
) AS child(name, sort_order)
WHERE parent.name = 'Остаток денежных средств на начало периода'
  AND parent.row_type = 'balance_open'
  AND NOT EXISTS (
    SELECT 1 FROM bdds_categories bc
    WHERE bc.name = child.name AND bc.parent_id = parent.id
  );

-- 4b) Остаток на конец периода
INSERT INTO bdds_categories (section_code, row_type, name, sort_order, is_calculated, calculation_formula)
SELECT 'operating', 'balance_close', 'Остаток денежных средств на конец периода', 999, true, 'sum_children'
WHERE NOT EXISTS (
  SELECT 1 FROM bdds_categories
  WHERE name = 'Остаток денежных средств на конец периода' AND row_type = 'balance_close'
);

INSERT INTO bdds_categories (section_code, row_type, name, sort_order, is_calculated, parent_id)
SELECT 'operating', 'balance_close', child.name, child.sort_order, false, parent.id
FROM bdds_categories parent,
(VALUES
  ('Остаток на расчётных счетах на конец (Свободный кэш)', 1),
  ('Остаток на ОБС на конец (Заблокированный/Целевой кэш)', 2)
) AS child(name, sort_order)
WHERE parent.name = 'Остаток денежных средств на конец периода'
  AND parent.row_type = 'balance_close'
  AND NOT EXISTS (
    SELECT 1 FROM bdds_categories bc
    WHERE bc.name = child.name AND bc.parent_id = parent.id
  );
