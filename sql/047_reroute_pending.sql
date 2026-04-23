-- 047: Одноразовый прогон — маршрутизация всех зависших `pending` проводок.
-- Появились из-за того, что ранние импорты проваливались на CHECK-ошибках:
-- INSERT успевал, а RPC etl_route_batch обрывался, оставляя строки pending.
-- После применения 044 и 046 запускаем маршрутизацию по каждому pending-батчу.

DO $$
DECLARE
  v_batch UUID;
BEGIN
  FOR v_batch IN
    SELECT DISTINCT import_batch_id
    FROM etl_1c_entries
    WHERE status = 'pending'
  LOOP
    PERFORM etl_route_batch(v_batch);
  END LOOP;
END $$;

-- Синхронизируем БДДС с актуальным состоянием ETL-фактов
SELECT etl_sync_bdds();
