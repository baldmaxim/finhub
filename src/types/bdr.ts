export type BdrEntryType = 'plan' | 'fact';

export type BdrSubType =
  | 'materials' | 'labor' | 'subcontract' | 'design' | 'rental'
  | 'fixed_expenses'
  | 'overhead_labor'
  | 'overhead_02' | 'overhead_03' | 'overhead_04' | 'overhead_05'
  | 'overhead_06' | 'overhead_07' | 'overhead_08' | 'overhead_09'
  | 'overhead_10' | 'overhead_11' | 'overhead_12' | 'overhead_13'
  | 'overhead_14' | 'overhead_15' | 'overhead_16' | 'overhead_17'
  | 'overhead_18' | 'overhead_19' | 'overhead_20' | 'overhead_21'
  | 'overhead_22' | 'overhead_23' | 'overhead_24';

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
  amount_nds: number;
  amount_without_nds: number;
  created_at: string;
}

export interface BdrSubEntryFormData {
  sub_type: BdrSubType;
  project_id: string | null;
  entry_date: string;
  company: string;
  description: string;
  amount: number;
  amount_nds?: number;
  amount_without_nds?: number;
}

export const NDS_SUB_TYPES: BdrSubType[] = [
  'materials', 'subcontract', 'design', 'rental',
  'overhead_02', 'overhead_03', 'overhead_04', 'overhead_05',
  'overhead_06', 'overhead_07', 'overhead_08', 'overhead_09',
  'overhead_10', 'overhead_11', 'overhead_12', 'overhead_13',
  'overhead_14', 'overhead_15', 'overhead_16', 'overhead_17',
  'overhead_18', 'overhead_19', 'overhead_20', 'overhead_21',
  'overhead_22', 'overhead_23', 'overhead_24',
];

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
  noPlan?: boolean;
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
  noPlan?: boolean;
  plan_total?: number;
  fact_total?: number;
  [key: string]: unknown;
}
