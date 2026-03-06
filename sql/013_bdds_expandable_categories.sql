-- Добавляем parent_id для иерархии категорий БДДС
ALTER TABLE bdds_categories ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES bdds_categories(id);

-- Делаем "Выплата средств по текущей деятельности" вычисляемой (сумма дочерних)
UPDATE bdds_categories
SET is_calculated = true, calculation_formula = 'sum_children'
WHERE name = 'Выплата средств по текущей деятельности'
  AND section_code = 'operating';

-- Дочерние строки для "Выплата средств по текущей деятельности"
INSERT INTO bdds_categories (section_code, row_type, name, sort_order, is_calculated, parent_id)
SELECT 'operating', 'expense', child.name, child.sort_order, false, parent.id
FROM bdds_categories parent,
(VALUES
  ('Материальные расходы (Закупка материалов)', 1),
  ('ФОТ основных рабочих', 2),
  ('Субподряд', 3),
  ('Проектные работы', 4),
  ('Аренда БК и подъемников', 5)
) AS child(name, sort_order)
WHERE parent.name = 'Выплата средств по текущей деятельности'
  AND parent.section_code = 'operating';

-- Делаем "Накладные расходы (косвенные) в т.ч. (ООЗ)" вычисляемой (сумма дочерних)
UPDATE bdds_categories
SET is_calculated = true, calculation_formula = 'sum_children'
WHERE name LIKE 'Накладные расходы%'
  AND section_code = 'operating'
  AND row_type = 'overhead';

-- Дочерние строки для "Накладные расходы (косвенные) в т.ч. (ООЗ)"
INSERT INTO bdds_categories (section_code, row_type, name, sort_order, is_calculated, parent_id)
SELECT 'operating', 'overhead', child.name, child.sort_order, false, parent.id
FROM bdds_categories parent,
(VALUES
  ('Оплата труда ИТР (в т.ч. Налоги с ФОТ)', 1),
  ('Водопотребление, водоотведение', 2),
  ('Электроснабжение', 3),
  ('Теплоснабжение', 4),
  ('Охрана', 5),
  ('Налоги и сборы', 6),
  ('Комиссия по банковским гарантиям', 7),
  ('Аренда строительного оборудования, механизмов, техники', 8),
  ('Аренда ДГУ и котельных', 9),
  ('Аренда автотранспорта', 10),
  ('Аренда экскаваторов и погрузчиков', 11),
  ('Аренда помещений, территорий, участков', 12),
  ('Разр.и согл. Инстанции', 13),
  ('Списание ОС', 14),
  ('Списание (опалубка)', 15),
  ('Списание (леса)', 16),
  ('Услуги связи', 17),
  ('Доп.выплаты сотрудникам', 18),
  ('Штрафы', 19),
  ('Проживание рабочих и линейщиков', 20),
  ('Возмещение затрат заказчику', 21),
  ('Страхование', 22),
  ('Работы и затраты гарантийного периода', 23),
  ('Прочие затраты и услуги', 24)
) AS child(name, sort_order)
WHERE parent.name LIKE 'Накладные расходы%'
  AND parent.section_code = 'operating'
  AND parent.row_type = 'overhead';
