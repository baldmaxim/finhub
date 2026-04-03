import type { BblRowDef } from '../types/bbl';

/** Секции ББЛ для tree-grid */
export interface IBblSection {
  key: string;
  title: string;
  summaryRowCode: string;
  childCodes: string[];
  isAsset?: boolean;
  isLiability?: boolean;
  isEquity?: boolean;
}

/** Все строки ББЛ */
export const BBL_ROWS: BblRowDef[] = [
  // === АКТИВЫ ===
  // I. Внеоборотные активы
  { code: 'noncurrent_total', name: 'Внеоборотные активы', isSemiBold: true, isCalculated: true, isSectionTotal: true },
  { code: 'fixed_assets', name: 'Основные средства', isChild: true },
  { code: 'intangible_assets', name: 'Нематериальные активы', isChild: true },
  { code: 'other_noncurrent', name: 'Прочие внеоборотные активы', isChild: true },

  // II. Оборотные активы
  { code: 'current_total', name: 'Оборотные активы', isSemiBold: true, isCalculated: true, isSectionTotal: true },
  { code: 'cash_total', name: 'Денежные средства', isChild: true, isCalculated: true, isLinked: true, linkedSource: 'БДДС: Остаток на конец периода (р/с + ОБС)' },
  { code: 'cash_rs', name: 'на расчётных счетах (р/с)', isChild: true, isCalculated: true, isLinked: true, linkedSource: 'БДДС → Остаток на расчётных счетах на конец периода' },
  { code: 'cash_obs', name: 'на ОБС (целевой)', isChild: true, isCalculated: true, isLinked: true, linkedSource: 'БДДС → Остаток на ОБС на конец периода' },
  { code: 'receivables', name: 'Дебиторская задолженность', isChild: true, isCalculated: true, isLinked: true, linkedSource: 'Σ детализации: КС-2 + Гарантийные удержания' },
  { code: 'receivables_ks2', name: 'Задолженность Заказчика по КС-2', isChild: true, isCalculated: true, isLinked: true, linkedSource: 'Входящее + КС-2 с Заказчиком (БДР) − Поступления (БДДС)' },
  { code: 'receivables_retentions', name: 'Гарантийные удержания к получению', isChild: true },
  { code: 'inventory_wip', name: 'Запасы и НЗП', isChild: true, isCalculated: true, isLinked: true, linkedSource: 'БДР → Выполнение (КС-2 внутренняя) − КС-2 с Заказчиком (нарастающий)' },
  { code: 'prepaid_expenses', name: 'Авансы выданные (Субподрядчикам)', isChild: true, isCalculated: true, isLinked: true, linkedSource: 'БДДС → Авансы субподрядчикам − БДР → Субподряд (Факт КС-2)' },
  { code: 'other_current_assets', name: 'Прочие оборотные активы', isChild: true },

  // ИТОГО АКТИВЫ
  { code: 'total_assets', name: 'ИТОГО АКТИВЫ', isSemiBold: true, isCalculated: true, isSectionTotal: true },

  // === ПАССИВЫ ===
  // III. Краткосрочные обязательства
  { code: 'current_liabilities_total', name: 'Краткосрочные обязательства', isSemiBold: true, isCalculated: true, isSectionTotal: true },
  { code: 'payables', name: 'Кредиторская задолженность', isChild: true, isCalculated: true, isLinked: true, linkedSource: 'Σ детализации: КС-2 + Гарантийные удержания' },
  { code: 'payables_sub_ks2', name: 'Задолженность перед субподрядчиками по КС-2', isChild: true, isCalculated: true, isLinked: true, linkedSource: 'Входящее + Расходы субподряд (БДР) − Оплаты субподряд (БДДС)' },
  { code: 'payables_retentions', name: 'Гарантийные удержания удержанные', isChild: true },
  { code: 'advances_received', name: 'Авансы полученные (от Заказчика)', isChild: true, isCalculated: true, isLinked: true, linkedSource: 'БДДС → Авансы от Заказчика − Оплата за выполненные работы' },
  { code: 'short_term_loans', name: 'Краткосрочные кредиты и займы', isChild: true },
  { code: 'current_lt_debt', name: 'Текущая часть долгосрочных обязательств', isChild: true },
  { code: 'other_current_liabilities', name: 'Прочие краткосрочные обязательства', isChild: true },

  // IV. Долгосрочные обязательства
  { code: 'lt_liabilities_total', name: 'Долгосрочные обязательства', isSemiBold: true, isCalculated: true, isSectionTotal: true },
  { code: 'long_term_loans', name: 'Долгосрочные кредиты и займы', isChild: true },
  { code: 'other_lt_liabilities', name: 'Прочие долгосрочные обязательства', isChild: true },

  // V. Собственный капитал
  { code: 'equity_total', name: 'Собственный капитал', isSemiBold: true, isCalculated: true, isSectionTotal: true },
  { code: 'share_capital', name: 'Уставный капитал', isChild: true },
  { code: 'retained_earnings', name: 'Нераспределенная прибыль', isChild: true, isCalculated: true, isLinked: true, linkedSource: 'БДР → Σ Чистая прибыль (накопит.) − БДДС → Дивиденды (накопит.)' },
  { code: 'reserve_capital', name: 'Резервный капитал', isChild: true },

  // ИТОГО ПАССИВЫ И КАПИТАЛ
  { code: 'total_liabilities_equity', name: 'ИТОГО ПАССИВЫ И КАПИТАЛ', isSemiBold: true, isCalculated: true, isSectionTotal: true },

  // Контроль баланса
  { code: 'balance_check', name: 'Контроль баланса (Разрыв)', isSemiBold: true, isCalculated: true, isBalanceCheck: true },
];

/** Секции для tree-grid */
export const BBL_SECTIONS: IBblSection[] = [
  {
    key: 'section_noncurrent',
    title: 'I. ВНЕОБОРОТНЫЕ АКТИВЫ',
    summaryRowCode: 'noncurrent_total',
    childCodes: ['fixed_assets', 'intangible_assets', 'other_noncurrent'],
    isAsset: true,
  },
  {
    key: 'section_current',
    title: 'II. ОБОРОТНЫЕ АКТИВЫ',
    summaryRowCode: 'current_total',
    childCodes: [
      'cash_total', 'cash_rs', 'cash_obs',
      'receivables', 'receivables_ks2', 'receivables_retentions',
      'inventory_wip', 'prepaid_expenses', 'other_current_assets',
    ],
    isAsset: true,
  },
  {
    key: 'section_total_assets',
    title: 'ИТОГО АКТИВЫ',
    summaryRowCode: 'total_assets',
    childCodes: [],
    isAsset: true,
  },
  {
    key: 'section_current_liabilities',
    title: 'III. КРАТКОСРОЧНЫЕ ОБЯЗАТЕЛЬСТВА',
    summaryRowCode: 'current_liabilities_total',
    childCodes: [
      'payables', 'payables_sub_ks2', 'payables_retentions',
      'advances_received', 'short_term_loans', 'current_lt_debt', 'other_current_liabilities',
    ],
    isLiability: true,
  },
  {
    key: 'section_lt_liabilities',
    title: 'IV. ДОЛГОСРОЧНЫЕ ОБЯЗАТЕЛЬСТВА',
    summaryRowCode: 'lt_liabilities_total',
    childCodes: ['long_term_loans', 'other_lt_liabilities'],
    isLiability: true,
  },
  {
    key: 'section_equity',
    title: 'V. СОБСТВЕННЫЙ КАПИТАЛ',
    summaryRowCode: 'equity_total',
    childCodes: ['share_capital', 'retained_earnings', 'reserve_capital'],
    isEquity: true,
  },
  {
    key: 'section_total_le',
    title: 'ИТОГО ПАССИВЫ И КАПИТАЛ',
    summaryRowCode: 'total_liabilities_equity',
    childCodes: [],
    isLiability: true,
  },
  {
    key: 'section_check',
    title: 'КОНТРОЛЬ БАЛАНСА (РАЗРЫВ)',
    summaryRowCode: 'balance_check',
    childCodes: [],
  },
];

/** Строки, редактируемые вручную (не linked и не calculated) */
export const BBL_MANUAL_CODES = BBL_ROWS
  .filter((r) => !r.isCalculated && !r.isSectionHeader)
  .map((r) => r.code);

/** Коды пассивных строк (отображать по модулю в UI) */
export const BBL_PASSIVE_CODES = new Set([
  'current_liabilities_total', 'payables', 'payables_sub_ks2', 'payables_retentions',
  'advances_received', 'short_term_loans', 'current_lt_debt', 'other_current_liabilities',
  'lt_liabilities_total', 'long_term_loans', 'other_lt_liabilities',
  'equity_total', 'share_capital', 'retained_earnings', 'reserve_capital',
  'total_liabilities_equity',
]);

/** Формулы для тултипов */
export const BBL_FORMULAS: Record<string, string> = {
  noncurrent_total: 'ОС + НМА + Прочие внеоборотные',
  current_total: 'Денежные ср-ва + Дебиторка + НЗП + Авансы выданные + Прочие',
  total_assets: 'Внеоборотные активы + Оборотные активы',
  cash_total: 'Из БДДС: Остаток на конец периода (р/с + ОБС)',
  cash_rs: 'Из БДДС: Остаток на расчётных счетах на конец',
  cash_obs: 'Из БДДС: Остаток на ОБС на конец',
  receivables: 'КС-2 Заказчика + Гарантийные удержания к получению',
  receivables_ks2: 'Входящее сальдо + КС-2 с Заказчиком (БДР) − Поступления (БДДС)',
  receivables_retentions: 'Ручной ввод: гарантийные удержания к получению',
  inventory_wip: 'Выполнение (КС-2 внутр.) − КС-2 с Заказчиком (нарастающий, БДР)',
  prepaid_expenses: 'Авансы субподрядчикам (БДДС) − Субподряд факт КС-2 (БДР)',
  payables: 'КС-2 субподрядчиков + Гарантийные удержания удержанные',
  payables_sub_ks2: 'Входящее сальдо + Субподряд КС-2 (БДР) − Оплаты субподряд (БДДС)',
  payables_retentions: 'Ручной ввод: гарантийные удержания удержанные',
  advances_received: 'Авансы от Заказчика (БДДС) − Оплата за выполненные работы (БДДС)',
  retained_earnings: 'Σ Чистая прибыль (БДР, накопит.) − Дивиденды (БДДС, накопит.)',
  current_liabilities_total: 'Кредиторка + Авансы получ. + Кредиты + Тек.часть долгосрочных + Прочие',
  lt_liabilities_total: 'Долгосрочные кредиты + Прочие долгосрочные',
  equity_total: 'Уставный капитал + Нераспр. прибыль + Резервный капитал',
  total_liabilities_equity: 'Краткосрочные + Долгосрочные + Капитал',
  balance_check: 'ИТОГО АКТИВЫ − ИТОГО ПАССИВЫ И КАПИТАЛ (должно быть = 0)',
};
