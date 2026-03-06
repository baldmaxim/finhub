export type SectionCode = 'operating' | 'investing' | 'financing';
export type RowType = 'income' | 'expense' | 'overhead' | 'net_cash_flow';
export type EntryType = 'plan' | 'fact';

export interface BddsCategory {
  id: string;
  section_code: SectionCode;
  row_type: RowType;
  name: string;
  sort_order: number;
  is_calculated: boolean;
  calculation_formula: string | null;
  parent_id: string | null;
}

export interface BddsEntry {
  id: string;
  category_id: string;
  year: number;
  month: number;
  amount: number;
  entry_type: EntryType;
}

export type MonthValues = Record<number, number>;

export interface BddsRow {
  categoryId: string;
  name: string;
  rowType: RowType;
  isCalculated: boolean;
  months: MonthValues;
  total: number;
  factMonths: MonthValues;
  factTotal: number;
  parentId: string | null;
  children?: BddsRow[];
}

export interface BddsSection {
  sectionCode: SectionCode;
  sectionName: string;
  rows: BddsRow[];
}

export interface BddsTableRow {
  key: string;
  name: string;
  isHeader?: boolean;
  isCalculated?: boolean;
  isExpandable?: boolean;
  isChild?: boolean;
  categoryId?: string;
  rowType?: RowType;
  month_1?: number;
  month_2?: number;
  month_3?: number;
  month_4?: number;
  month_5?: number;
  month_6?: number;
  month_7?: number;
  month_8?: number;
  month_9?: number;
  month_10?: number;
  month_11?: number;
  month_12?: number;
  total?: number;
  [key: string]: unknown;
}
