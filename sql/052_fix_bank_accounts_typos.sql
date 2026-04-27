-- 052: Исправление справочника расчётных счетов
--
-- Проблемы, обнаруженные при сверке с карточкой сч.51 ООО «СУ-10»
-- по р/с 40702810225644213694 (ВТБ Центральный):
--
-- 1) В seed (035a) у Райффайзенбанка номер счёта на одну цифру короче (19 знаков
--    вместо 20). Из-за этого ETL не находит этот счёт в bank_accounts при разборе
--    строк выписки и теряет связь internal_transfer для соответствующих переводов.
--    Пример в выписке: 22.09.2025 — перевод 300 000 руб на 40702810500000200367.
--
-- 2) В seed отсутствует депозитный счёт ВТБ ОПЕРУ 42102810800810084861.
--    Используется в выписке: 20.02.2026 размещение 49 800 000 ₽ и
--    24.02.2026 возврат 49 800 000 ₽ + 75 313,97 ₽ процентов.

-- 1) Слить опечатанную запись (19 знаков) с корректной (20 знаков).
--    Простой UPDATE номера упирается в unique-constraint, т.к. корректная
--    запись уже есть в seed (035a). Поэтому: перепривязываем все FK и удаляем дубль.
DO $$
DECLARE
  v_bad_id  UUID;
  v_good_id UUID;
BEGIN
  SELECT id INTO v_bad_id  FROM bank_accounts WHERE account_number = '4070281050000200367';
  SELECT id INTO v_good_id FROM bank_accounts WHERE account_number = '40702810500000200367';

  IF v_bad_id IS NOT NULL AND v_good_id IS NOT NULL THEN
    UPDATE etl_1c_entries SET bank_account_id        = v_good_id WHERE bank_account_id        = v_bad_id;
    UPDATE etl_1c_entries SET target_bank_account_id = v_good_id WHERE target_bank_account_id = v_bad_id;
    DELETE FROM bank_accounts WHERE id = v_bad_id;
  ELSIF v_bad_id IS NOT NULL AND v_good_id IS NULL THEN
    -- Корректной записи нет — просто переименовываем.
    UPDATE bank_accounts
       SET account_number = '40702810500000200367',
           updated_at     = now()
     WHERE id = v_bad_id;
  END IF;
END $$;

-- 2) Добавить недостающий депозитный счёт ВТБ ОПЕРУ.
INSERT INTO bank_accounts (account_number, bank_name, bik, description)
VALUES ('42102810800810084861',
        'ФИЛИАЛ "ЦЕНТРАЛЬНЫЙ" БАНКА ВТБ (ПАО) ОПЕРУ',
        '044525411',
        'ДЕПОЗИТНЫЙ')
ON CONFLICT (account_number) DO UPDATE SET
  bank_name   = EXCLUDED.bank_name,
  bik         = EXCLUDED.bik,
  description = EXCLUDED.description,
  updated_at  = now();

-- 3) После применения миграции — пересчитать привязку bank_account_id
--    у уже загруженных строк ETL, где раньше счёт не нашёлся.
--    Сравниваем по «номер_счёта, ...» в analytics_dt либо analytics_kt.
UPDATE etl_1c_entries e
   SET bank_account_id = ba.id
  FROM bank_accounts ba
 WHERE e.bank_account_id IS NULL
   AND (e.analytics_dt LIKE ba.account_number || '%'
        OR e.analytics_kt LIKE ba.account_number || '%')
   AND ba.account_number IN ('40702810500000200367', '42102810800810084861');
