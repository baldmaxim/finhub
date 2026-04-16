-- Обновление авансовых условий Досье договора: ЖК ДОМ 56 — Договор подряда №165/9/2024
-- п.4.7.1.1: Основной аванс 5% = 288 604 236,29 ₽, 10 раб.дней, БГ обязательна
-- п.4.7.1.2: Целевые авансы до 25%, платёж напрямую Поставщику, без БГ

update contract_dossiers
set bdds_data = bdds_data || '{
  "advance_pct": 5,
  "advance_amount": 288604236.29,
  "target_advance_max_pct": 25,
  "target_advance_to_supplier": true,
  "target_advance_requires_bg": false,
  "target_advance_decision_days": 3,
  "target_advance_payment_days": 10,
  "advance_offset_method": "proportional"
}'::jsonb
where project_id = (
  select id from projects
  where name ilike '%ДОМ 56%'
     or name ilike '%Фридриха Энгельса%'
     or name ilike '%Энгельса%'
  limit 1
)
  and document_type = 'contract'
  and document_number = '№165/9/2024';
