import type { WorkType } from '../types/bddsIncome';

export const WORK_TYPES: WorkType[] = [
  { code: 'header_works', name: 'Наименование работ', isHeader: true },
  { code: 'prep_works', name: 'Подготовительные работы', group: 'smr' },
  { code: 'dewatering', name: 'Водопонижение', group: 'smr' },
  { code: 'earthworks', name: 'Земляные работы (Котлован)', group: 'smr' },
  { code: 'waterproofing', name: 'Гидроизоляция', group: 'smr' },
  { code: 'monolith', name: 'Монолит', group: 'smr' },
  { code: 'masonry', name: 'Кладка', group: 'smr' },
  { code: 'facade', name: 'Фасад', group: 'smr' },
  { code: 'roofing', name: 'Кровля', group: 'smr' },
  { code: 'interior', name: 'Внутренняя отделка', group: 'smr' },
  { code: 'elevators', name: 'Лифты', group: 'smr' },
  { code: 'engineering', name: 'Внутренние инженерные системы', group: 'smr' },
  { code: 'landscaping', name: 'Благоустройство', group: 'smr' },
  { code: 'external_networks', name: 'Наружные сети', group: 'smr' },
  { code: 'total_smr', name: 'Всего СМР по проекту', isCalculated: true },
  { code: 'total_smr_no_vat', name: 'Всего СМР по проекту без НДС', isCalculated: true },
  { code: 'advance_income', name: 'Аванс (Приход)', group: 'finance' },
  { code: 'advance_offset', name: 'Зачет Аванса', group: 'finance' },
  { code: 'guarantee_retention', name: 'Гарантийное Удержание', group: 'finance' },
  { code: 'guarantee_return', name: 'Возврат ГУ', group: 'finance' },
  { code: 'total_income', name: 'Итого поступление за СМР по проекту', isCalculated: true },
];

export const SMR_CODES = WORK_TYPES
  .filter((w) => w.group === 'smr')
  .map((w) => w.code);

export const DATA_WORK_TYPES = WORK_TYPES.filter(
  (w) => !w.isHeader && !w.isCalculated
);

export function findWorkTypeByName(name: string): WorkType | undefined {
  const trimmed = name.trim().toLowerCase();
  return DATA_WORK_TYPES.find(
    (w) => w.name.toLowerCase() === trimmed
  );
}
