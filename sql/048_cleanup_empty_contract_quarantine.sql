-- 048: Одноразовая чистка — удаляем карантинные проводки с пустым contract_name.
-- Это те строки, где старый парсер parseAnalyticsKt не распознал договор
-- (например, «Договор К-14» без символа №). После фикса парсера эти строки
-- нужно удалить из БД, чтобы дедуп-индекс не блокировал повторный импорт файла.
--
-- ВАЖНО: удаляем только то, что заведомо парсер не осилил:
--   status = 'quarantine'  AND  (contract_name IS NULL OR contract_name = '')
-- Карантин по другим причинам (нет маппинга контрагент→проект при корректном
-- contract_name) не трогаем.

-- Сначала покажем, что будет удалено
SELECT
  COUNT(*)          AS to_delete,
  MIN(doc_date)     AS min_date,
  MAX(doc_date)     AS max_date,
  SUM(amount)       AS total_amount
FROM etl_1c_entries
WHERE status = 'quarantine'
  AND (contract_name IS NULL OR contract_name = '');

-- Удаляем
DELETE FROM etl_1c_entries
WHERE status = 'quarantine'
  AND (contract_name IS NULL OR contract_name = '');
