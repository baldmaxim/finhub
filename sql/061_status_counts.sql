-- 061: RPC etl_get_status_counts — счётчики для шапки страницы Импорт
--
-- Контекст: после перевода EtlImportTab на серверную пагинацию клиент
-- больше не тянет все 200k проводок, а значит карточки «Всего/Разнесено/
-- Карантин/Вручную» нужно считать отдельным быстрым запросом. Один RPC
-- даёт все 4 числа за один проход (FILTER WHERE), а не 4 отдельных
-- count-запроса.
--
-- Параметры дублируют фильтры таблицы (дата и поиск). Статус не нужен —
-- мы как раз считаем количество по каждому статусу.

CREATE OR REPLACE FUNCTION etl_get_status_counts(
  p_date_from DATE DEFAULT NULL,
  p_date_to   DATE DEFAULT NULL,
  p_search    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'total',      COUNT(*),
    'pending',    COUNT(*) FILTER (WHERE status = 'pending'),
    'routed',     COUNT(*) FILTER (WHERE status = 'routed'),
    'quarantine', COUNT(*) FILTER (WHERE status = 'quarantine'),
    'manual',     COUNT(*) FILTER (WHERE status = 'manual')
  )
  FROM etl_1c_entries
  WHERE (p_date_from IS NULL OR doc_date >= p_date_from)
    AND (p_date_to   IS NULL OR doc_date <= p_date_to)
    AND (
      p_search IS NULL
      OR counterparty_name ILIKE '%'||p_search||'%'
      OR contract_name     ILIKE '%'||p_search||'%'
    );
$$;

ALTER FUNCTION etl_get_status_counts(DATE, DATE, TEXT) SET statement_timeout = '60s';

NOTIFY pgrst, 'reload schema';
