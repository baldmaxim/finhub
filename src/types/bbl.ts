export type BblEntryType = 'plan' | 'fact';

export interface BblEntry {
  id: string;
  row_code: string;
  year: number;
  month: number;
  amount: number;
  entry_type: BblEntryType;
  project_id: string | null;
}

export interface BblRowDef {
  code: string;
  name: string;
  /** Заголовок секции */
  isSectionHeader?: boolean;
  /** Жирная строка-итог */
  isSemiBold?: boolean;
  /** Расчётная строка (нередактируемая) */
  isCalculated?: boolean;
  /** Связь с БДР/БДДС (read-only, серый фон) */
  isLinked?: boolean;
  /** Источник данных для тултипа */
  linkedSource?: string;
  /** Дочерняя строка (отступ) */
  isChild?: boolean;
  /** Строка-итог раздела */
  isSectionTotal?: boolean;
  /** Строка контроля баланса */
  isBalanceCheck?: boolean;
}

export type MonthValues = Record<number, number>;

export interface BblTableRow {
  key: string;
  name: string;
  rowCode: string;
  isSectionHeader?: boolean;
  isSemiBold?: boolean;
  isCalculated?: boolean;
  isLinked?: boolean;
  linkedSource?: string;
  isChild?: boolean;
  isSectionTotal?: boolean;
  isBalanceCheck?: boolean;
  plan_total?: number;
  fact_total?: number;
  [key: string]: unknown;
}

export interface IBblTreeRow extends BblTableRow {
  children?: IBblTreeRow[];
}

export interface IBblHealthMetrics {
  /** Чистый оборотный капитал (NWC) */
  nwc: number;
  /** Коэффициент текущей ликвидности (Current Ratio) */
  currentRatio: number | null;
  /** Покрытие авансов (Advance Coverage Ratio) */
  advanceCoverageRatio: number | null;
  /** Доля НЗП в Активах (%) */
  wipShare: number;
  /** Итого активы */
  totalAssets: number;
  /** Итого пассивы */
  totalLiabilitiesEquity: number;
  /** Разрыв баланса */
  balanceGap: number;
}
