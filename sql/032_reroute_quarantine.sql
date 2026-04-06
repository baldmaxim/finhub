-- 032: Перемаршрутизация карантинных записей
-- Сбрасывает quarantine → pending и повторно запускает маршрутизацию

CREATE OR REPLACE FUNCTION etl_reroute_quarantine()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch_id UUID;
  v_updated INT;
  v_result JSONB;
BEGIN
  -- Создаём виртуальный batch для перемаршрутизации
  v_batch_id := gen_random_uuid();

  -- Сбрасываем карантинные записи в pending с новым batch_id
  UPDATE etl_1c_entries
  SET status = 'pending',
      import_batch_id = v_batch_id,
      route_log = NULL,
      routed_project_id = NULL,
      routed_category_id = NULL,
      route_method = NULL,
      routed_at = NULL,
      updated_at = now()
  WHERE status = 'quarantine';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('routed', 0, 'quarantine', 0, 'message', 'Нет записей в карантине');
  END IF;

  -- Запускаем стандартную маршрутизацию
  v_result := etl_route_batch(v_batch_id);

  RETURN v_result;
END;
$$;
