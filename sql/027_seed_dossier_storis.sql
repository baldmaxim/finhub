-- Финансовое досье: ЖК СТОРИС — Договор №06/2023-СТ генподряда
-- Данные извлечены из договора от 20.06.2023

insert into contract_dossiers (
  project_id, document_type, document_number, document_date,
  header_data, bdds_data, bdr_data, penalties_data
)
select
  p.id,
  'contract',
  '№06/2023-СТ',
  '2023-06-20'::date,
  '{
    "contract_name": "Договор генподряда №06/2023-СТ",
    "contract_object": "ЖК СТОРИС — Высотный градостроительный комплекс с административно-офисным комплексом и подземным гаражом, ул. Лобачевского, 124/3А",
    "contract_amount": 4850000000,
    "price_type": "fixed",
    "nds_rate": 20,
    "start_date": "2023-05-15",
    "end_date": "2025-12-15",
    "status": "active",
    "duration_months": 31
  }'::jsonb,
  '{
    "advance_payment_days": 15,
    "advance_requires_bg": true,
    "preferential_advance_pct": 0,
    "preferential_advance_bank": "Банк ДОМ.РФ",
    "ks2_submission_day": 5,
    "ks2_acceptance_days": 15,
    "ks2_payment_days": 15,
    "gu_rate_pct": 5,
    "gu_return_months": 24,
    "gu_bg_replacement": true,
    "gu_bg_return_days": 10
  }'::jsonb,
  '{
    "savings_gp_pct": 0,
    "savings_customer_pct": 100,
    "savings_customer_init_gp_pct": 0,
    "savings_customer_init_pct": 100,
    "price_revision_threshold_pct": 0,
    "price_revision_appendix": "",
    "insurance_go_amount": 0,
    "opex_items": [
      {"title": "Охрана периметра стройплощадки", "description": "ЧОП, видеонаблюдение, пропускная система — за счёт ГП"},
      {"title": "Временные здания и сооружения", "description": "Возведение, эксплуатация, демонтаж — включены в цену"},
      {"title": "Энергоресурсы до ЗОС", "description": "Электричество, вода, отопление, водоотведение — оплата по тарифам ресурсоснабжающих орг."},
      {"title": "Вывоз строительных отходов", "description": "Договоры с полигонами — за счёт ГП"},
      {"title": "Содержание площадки после ЗОС", "description": "8 000 000 ₽/мес при задержке ЗОС не по вине ГП (охрана, ФОТ ИТР, коммуналка)"}
    ]
  }'::jsonb,
  '{
    "penalties": [
      {"violation": "Просрочка Ключевых событий (промежуточных сроков)", "rate": 100000, "unit": "за каждый день"},
      {"violation": "Просрочка окончания работ / получения ЗОС", "rate": 150000, "unit": "за каждый день"},
      {"violation": "Просрочка подписания Итогового акта (Акт №3)", "rate": 150000, "unit": "за каждый день"},
      {"violation": "Задержка устранения дефектов в гарантийный срок", "rate": 50000, "unit": "за каждый день"},
      {"violation": "Нарушение требований охраны труда / ТБ", "rate": 500000, "unit": "за каждый случай"}
    ],
    "customer_penalty_rate_pct": 0.03,
    "customer_penalty_start_day": 10
  }'::jsonb
from projects p
where p.name ilike '%СТОРИС%'
limit 1;
