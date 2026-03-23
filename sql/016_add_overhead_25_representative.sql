-- Добавление overhead_25 (Представительские расходы) в CHECK constraint для bdr_sub_entries

ALTER TABLE bdr_sub_entries
  DROP CONSTRAINT IF EXISTS bdr_sub_entries_sub_type_check;

ALTER TABLE bdr_sub_entries
  ADD CONSTRAINT bdr_sub_entries_sub_type_check
    CHECK (sub_type IN (
      'materials', 'labor', 'subcontract', 'design', 'rental',
      'fixed_expenses',
      'overhead_labor',
      'overhead_02', 'overhead_03', 'overhead_04', 'overhead_05',
      'overhead_06', 'overhead_07', 'overhead_08', 'overhead_09',
      'overhead_10', 'overhead_11', 'overhead_12', 'overhead_13',
      'overhead_14', 'overhead_15', 'overhead_16', 'overhead_17',
      'overhead_18', 'overhead_19', 'overhead_20', 'overhead_21',
      'overhead_22', 'overhead_23', 'overhead_24', 'overhead_25'
    ));

-- Добавление дочерней категории "Представительские расходы" в БДДС
INSERT INTO bdds_categories (section_code, row_type, name, sort_order, is_calculated, parent_id)
SELECT 'operating', 'overhead', 'Представительские расходы', 25, false, parent.id
FROM bdds_categories parent
WHERE parent.name LIKE 'Накладные расходы%'
  AND parent.section_code = 'operating'
  AND parent.row_type = 'overhead'
  AND parent.parent_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM bdds_categories
    WHERE name = 'Представительские расходы'
      AND section_code = 'operating'
      AND row_type = 'overhead'
  );
