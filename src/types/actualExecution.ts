export interface ActualExecutionEntry {
  id: string;
  project_id: string;
  month_key: string;
  ks_amount: number;
  fact_amount: number;
  created_at: string;
  updated_at: string;
}

export interface ActualExecutionFormData {
  project_id: string;
  month_key: string;
  ks_amount: number;
  fact_amount: number;
}

export interface ActualExecutionTotals {
  ks: Record<number, number>;
  fact: Record<number, number>;
}
