export interface BddsIncomeEntry {
  id: string;
  project_id: string;
  work_type_code: string;
  month_key: string;
  amount: number;
}

export interface BddsIncomeNote {
  id: string;
  project_id: string;
  work_type_code: string;
  note: string;
}

export interface WorkType {
  code: string;
  name: string;
  isHeader?: boolean;
  isCalculated?: boolean;
  group?: 'smr' | 'finance' | 'total';
  isBold?: boolean;
}

export interface IncomeTableRow {
  key: string;
  workTypeCode: string;
  name: string;
  note: string;
  isHeader?: boolean;
  isCalculated?: boolean;
  [monthKey: string]: unknown;
}

export interface ExcelImportData {
  workTypeCode: string;
  note: string;
  months: Record<string, number>;
}

export interface SummaryTableRow {
  key: string;
  projectName: string;
  projectId: string;
  rowLabel: string;
  rowType: 'total_smr' | 'total_income';
  [monthKey: string]: unknown;
}
