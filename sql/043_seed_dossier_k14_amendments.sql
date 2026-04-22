-- =============================================
-- Миграция 043: Дополнительные соглашения к Договору генподряда №К14 от 25.04.2025 г.
-- Проект: ЖК PRIMAVERA квартал Bellini. К14
-- Застройщик: ООО «СЗ «Стадион «Спартак» (Савин Н.О.)
-- Генподрядчик: ООО «СУ-10» (Товбин М.С.)
--
-- Входят ДС: №1 (2025, без даты), №4 (01.10.2025), №7 (16.02.2026), №8 (24.02.2026)
-- =============================================

-- Удаляем ранее загруженные ДС по К14, чтобы миграция была идемпотентной
delete from contract_dossiers
where document_type = 'amendment'
  and project_id in (
    select project_id from contract_dossiers
    where document_type = 'contract'
      and document_number = '№К14'
  )
  and document_number in ('ДС №1', 'ДС №4', 'ДС №7', 'ДС №8');

-- ============================================================
-- ДС №1 (2025, дата подписания не указана) — разовое разрешение на аванс без БГ
-- Разрешает выплату Аванса до 170 000 000 ₽ (в т.ч. НДС 20% = 28 333 333 ₽)
-- БЕЗ Банковской Гарантии (отступление от п.22.1.1)
-- При условии поручительства физлица Владимирова Ильи Владиславовича (ИНН 774314103512)
-- Шапка/БДДС/БДР/штрафы не меняются — копируем из базового договора
-- ============================================================
insert into contract_dossiers (
  project_id, document_type, document_number, document_date,
  header_data, bdds_data, bdr_data, penalties_data,
  amendment_summary, is_active
)
select
  base.project_id,
  'amendment',
  'ДС №1',
  null,
  base.header_data,
  base.bdds_data,
  base.bdr_data,
  base.penalties_data,
  'Разрешена выплата Аванса до 170 000 000 ₽ (в т.ч. НДС 20% — 28 333 333 ₽) БЕЗ Банковской Гарантии (п.22.1.1) при условии поручительства физического лица — Владимирова Ильи Владиславовича (ИНН 774314103512). Разовое отступление от условия БГ на аванс.',
  true
from contract_dossiers base
where base.document_type = 'contract'
  and base.document_number = '№К14';

-- ============================================================
-- ДС №4 от 01.10.2025 — изменение цены договора (п.13.1.1.1)
-- Новая цена СМР и иных Работ, услуг: 15 783 711 735,72 ₽ вкл. НДС 20%,
-- вкл. ГУ 2,5% (вкл. НДС 20%). Было: 15 800 000 000 ₽ (в базовом договоре).
-- Приложение №1 «Протокол договорной цены» — в новой редакции (Приложение №1 к ДС).
-- Приложение №4 «График финансирования Работ» — в новой редакции (Приложение №2 к ДС).
-- ============================================================
insert into contract_dossiers (
  project_id, document_type, document_number, document_date,
  header_data, bdds_data, bdr_data, penalties_data,
  amendment_summary, is_active
)
select
  base.project_id,
  'amendment',
  'ДС №4',
  '2025-10-01'::date,
  -- Шапка: обновляем contract_amount
  jsonb_set(base.header_data, '{contract_amount}', to_jsonb(15783711735.72::numeric)),
  base.bdds_data,
  base.bdr_data,
  base.penalties_data,
  'Новая цена Договора — 15 783 711 735,72 ₽ вкл. НДС 20% (включая ГУ 2,5%). Новая редакция Приложения №1 «Протокол договорной цены» и Приложения №4 «График финансирования Работ».',
  true
from contract_dossiers base
where base.document_type = 'contract'
  and base.document_number = '№К14';

-- ============================================================
-- ДС №7 от 16.02.2026 — изменение сроков (п.8.1.3)
-- Начало СМР          — 01.05.2025 (не позднее)
-- Окончание СМР       — 30.12.2027 (не позднее)
-- Получение ЗОС       — 01.02.2028 (не позднее)
-- Ввод в эксплуатацию — 01.04.2028 (не позднее)
-- Окончание передачи  — 01.10.2028 (не позднее)
-- Приложение №3 «График выполнения Работ» — в новой редакции.
--
-- В header обновляем: start_date=2025-05-01, end_date=2028-10-01 (крайний срок передачи),
-- duration_months=41 (с 01.05.2025 по 01.10.2028).
-- ============================================================
insert into contract_dossiers (
  project_id, document_type, document_number, document_date,
  header_data, bdds_data, bdr_data, penalties_data,
  amendment_summary, is_active
)
select
  base.project_id,
  'amendment',
  'ДС №7',
  '2026-02-16'::date,
  base.header_data
    || jsonb_build_object(
      'start_date', '2025-05-01',
      'end_date', '2028-10-01',
      'duration_months', 41
    ),
  base.bdds_data,
  base.bdr_data,
  base.penalties_data,
  'Новые сроки (п.8.1.3): начало СМР — 01.05.2025, окончание СМР — 30.12.2027, ЗОС — 01.02.2028, ввод в эксплуатацию — 01.04.2028, окончание Мероприятий по передаче — 01.10.2028. Новая редакция Приложения №3 «График выполнения Работ».',
  true
from contract_dossiers base
where base.document_type = 'contract'
  and base.document_number = '№К14';

-- ============================================================
-- ДС №8 от 24.02.2026 — НДС «по применимой ставке» (п.13.1.1)
-- Сумма Договора не изменяется: 15 783 711 735,72 ₽ (после ДС №4).
-- «НДС 20%» заменён на «НДС по применимой ставке, определяемой законодательством
-- в соответствующем периоде» — и в теле Договора, и в Приложениях.
-- Применяется к отношениям Сторон с 01.01.2026 (п.2 ст.425 ГК РФ).
-- Новая редакция Приложения №1 «Протокол договорной цены».
--
-- nds_rate оставляем 20 (числовое поле), переменный характер ставки фиксируется
-- в amendment_summary.
-- ============================================================
insert into contract_dossiers (
  project_id, document_type, document_number, document_date,
  header_data, bdds_data, bdr_data, penalties_data,
  amendment_summary, is_active
)
select
  base.project_id,
  'amendment',
  'ДС №8',
  '2026-02-24'::date,
  jsonb_set(base.header_data, '{contract_amount}', to_jsonb(15783711735.72::numeric)),
  base.bdds_data,
  base.bdr_data,
  base.penalties_data,
  'НДС изменён с «20%» на «по применимой ставке, определяемой законодательством в соответствующем периоде» (п.13.1.1 и все Приложения к Договору). Применяется к отношениям Сторон с 01.01.2026 (п.2 ст.425 ГК РФ). Сумма Договора не меняется — 15 783 711 735,72 ₽. Новая редакция Приложения №1 «Протокол договорной цены».',
  true
from contract_dossiers base
where base.document_type = 'contract'
  and base.document_number = '№К14';
