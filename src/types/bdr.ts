export type BdrEntryType = 'plan' | 'fact';

export type BdrSubType = 'materials' | 'labor' | 'subcontract' | 'design' | 'rental' | 'overhead_labor';

export interface BdrEntry {
  id: string;
  row_code: string;
  year: number;
  month: number;
  amount: number;
  entry_type: BdrEntryType;
}

export interface BdrSubEntry {
  id: string;
  sub_type: BdrSubType;
  project_id: string | null;
  entry_date: string;
  company: string;
  description: string;
  amount: number;
  created_at: string;
}

export interface BdrSubEntryFormData {
  sub_type: BdrSubType;
  project_id: string | null;
  entry_date: string;
  company: string;
  description: string;
  amount: number;
}

export interface BdrRowDef {
  code: string;
  name: string;
  isHeader?: boolean;
  isSemiBold?: boolean;
  isCalculated?: boolean;
  isClickable?: boolean;
  subType?: BdrSubType;
  isOverhead?: boolean;
  isPercent?: boolean;
  isCostParent?: boolean;
  isCostChild?: boolean;
  isPlanCalculated?: boolean;
}

export type MonthValues = Record<number, number>;

export interface BdrTableRow {
  key: string;
  name: string;
  rowCode: string;
  isHeader?: boolean;
  isSemiBold?: boolean;
  isCalculated?: boolean;
  isClickable?: boolean;
  isOverhead?: boolean;
  isOverheadItem?: boolean;
  isPercent?: boolean;
  subType?: BdrSubType;
  isCostParent?: boolean;
  isCostChild?: boolean;
  isPlanCalculated?: boolean;
  plan_total?: number;
  fact_total?: number;
  [key: string]: unknown;
}
