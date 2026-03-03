import type { BdrRowDef, BdrSubType } from '../types/bdr';

export const BDR_ROWS: BdrRowDef[] = [
  { code: 'bdr_header', name: 'Статья БДР', isHeader: true },
  { code: 'revenue', name: 'Выручка', isSemiBold: true, isCalculated: true },
  { code: 'revenue_smr', name: 'Выручка от СМР всего (КС-2 с Заказчиком)', isCalculated: true },
  { code: 'execution_total', name: 'Выполнение всего (КС-2 внутренняя)', isCalculated: true },
  { code: 'contract_not_accepted', name: 'Всего работы по контракту выполненные, но не принятые заказчиком', isCalculated: true },
  { code: 'readiness_percent', name: 'Процент готовности с начала строительства', isPercent: true },
  { code: 'nzp_to_revenue', name: 'Отношение НЗП к Выручке', isPercent: true, isCalculated: true },

  { code: 'cost_total', name: 'Себестоимость в т.ч.', isSemiBold: true, isCalculated: true },
  { code: 'cost_materials', name: 'Материальные расходы', isClickable: true, subType: 'materials' },
  { code: 'cost_labor', name: 'ФОТ основных рабочих', isClickable: true, subType: 'labor' },
  { code: 'cost_subcontract', name: 'Субподряд', isClickable: true, subType: 'subcontract' },
  { code: 'cost_design', name: 'Проектные работы', isClickable: true, subType: 'design' },
  { code: 'cost_rental', name: 'Аренда БК и подъемников', isClickable: true, subType: 'rental' },
  { code: 'cost_overhead', name: 'Накладные расходы (косвенные) в т.ч. (ООЗ)', isClickable: true, isOverhead: true, isCalculated: true },

  { code: 'overhead_ratio', name: 'Коэф.накладных расходов', isPercent: true, isCalculated: true },
  { code: 'marginal_profit', name: 'Маржинальная прибыль', isCalculated: true },
  { code: 'fixed_expenses', name: 'Постоянные коммерческие и управленческие расходы (в т.ч. Амортизация) (ОФЗ)' },
  { code: 'operating_profit', name: 'Операционная прибыль', isCalculated: true },
  { code: 'operating_profit_pct', name: 'В % к общей прибыли', isPercent: true, isCalculated: true },
  { code: 'other_income_expense', name: 'Прочие доходы (расходы)' },
  { code: 'profit_before_tax', name: 'Прибыль (Убыток) до налогообложение', isCalculated: true },
  { code: 'net_profit', name: 'Чистая прибыль', isCalculated: true },
  { code: 'dividends', name: 'Дивиденды и прочее распределение прибыли' },
];

export const BDR_OVERHEAD_ROWS: BdrRowDef[] = [
  { code: 'overhead_01', name: 'Оплата труда ИТР (в т.ч. Налоги с ФОТ)', isClickable: true, subType: 'overhead_labor' as const },
  { code: 'overhead_02', name: 'Водопотребление, водоотведение' },
  { code: 'overhead_03', name: 'Электроснабжение' },
  { code: 'overhead_04', name: 'Теплоснабжение' },
  { code: 'overhead_05', name: 'Охрана' },
  { code: 'overhead_06', name: 'Налоги и сборы' },
  { code: 'overhead_07', name: 'Комиссия по банковским гарантиям' },
  { code: 'overhead_08', name: 'Аренда строительного оборудования, механизмов, техники' },
  { code: 'overhead_09', name: 'Аренда ДГУ и котельных' },
  { code: 'overhead_10', name: 'Аренда автотранспорта' },
  { code: 'overhead_11', name: 'Аренда экскаваторов и погрузчиков' },
  { code: 'overhead_12', name: 'Аренда помещений, территорий, участков' },
  { code: 'overhead_13', name: 'Разр.и согл. Инстанции' },
  { code: 'overhead_14', name: 'Списание ОС' },
  { code: 'overhead_15', name: 'Списание (опалубка)' },
  { code: 'overhead_16', name: 'Списание (леса)' },
  { code: 'overhead_17', name: 'Услуги связи' },
  { code: 'overhead_18', name: 'Доп.выплаты сотрудникам' },
  { code: 'overhead_19', name: 'Штрафы' },
  { code: 'overhead_20', name: 'Проживание рабочих и линейщиков' },
  { code: 'overhead_21', name: 'Возмещение затрат заказчику' },
  { code: 'overhead_22', name: 'Страхование' },
  { code: 'overhead_23', name: 'Работы и затраты гарантийного периода' },
  { code: 'overhead_24', name: 'Прочие затраты и услуги' },
];

export const OVERHEAD_CODES = BDR_OVERHEAD_ROWS.map((r) => r.code);

export const COST_ROW_CODES = [
  'cost_materials',
  'cost_labor',
  'cost_subcontract',
  'cost_design',
  'cost_rental',
  'cost_overhead',
] as const;

export const BDR_SUB_TYPES: Record<BdrSubType, { title: string; rowCode: string }> = {
  materials: { title: 'Списание материалов', rowCode: 'cost_materials' },
  labor: { title: 'Оплата труда рабочих', rowCode: 'cost_labor' },
  subcontract: { title: 'Субподряд проекта', rowCode: 'cost_subcontract' },
  design: { title: 'Проектные работы по проекту', rowCode: 'cost_design' },
  rental: { title: 'Аренда БК и подъемников по проекту', rowCode: 'cost_rental' },
  overhead_labor: { title: 'Оплата труда ИТР (в т.ч. Налоги с ФОТ) по проекту', rowCode: 'overhead_01' },
};
