-- 046: Расширяем CHECK route_method в etl_1c_entries
-- В 029 было: ('auto', 'regex', 'manual')
-- В 042 etl_route_batch начал писать 'rule' (структурные правила маршрутизации),
-- CHECK не обновили — из-за чего RPC etl_route_batch падал с 400.

ALTER TABLE etl_1c_entries
  DROP CONSTRAINT IF EXISTS etl_1c_entries_route_method_check;

ALTER TABLE etl_1c_entries
  ADD CONSTRAINT etl_1c_entries_route_method_check
  CHECK (route_method IN ('auto', 'regex', 'manual', 'rule'));
