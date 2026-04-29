-- 065: фикс порядка строк operating-секции БДДС.
--
-- В миграции 064 ОФЗ-родителю поставили sort_order=900,
-- из-за чего блок выводится ПОСЛЕ строки «ЧДП от текущей деятельности»
-- (у неё sort_order=4). Расчёт ЧДП (calculations.ts) суммирует ВСЕ
-- overhead-строки, поэтому суммарно ОФЗ в ЧДП учитывается корректно —
-- проблема чисто визуальная.
--
-- Двигаем ЧДП на 5, ОФЗ ставим на 4: блок встаёт между ООЗ (3) и ЧДП (5).

UPDATE bdds_categories
SET sort_order = 5, updated_at = now()
WHERE section_code = 'operating'
  AND row_type = 'net_cash_flow'
  AND name = 'ЧДП от текущей деятельности';

UPDATE bdds_categories
SET sort_order = 4, updated_at = now()
WHERE section_code = 'operating'
  AND row_type = 'overhead'
  AND parent_id IS NULL
  AND name = 'Постоянные коммерческие и управленческие расходы (ОФЗ)';

NOTIFY pgrst, 'reload schema';
