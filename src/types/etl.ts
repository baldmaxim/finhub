export type EtlDocType = 'receipt' | 'debt_correction' | 'other';
export type EtlEntryStatus = 'pending' | 'routed' | 'quarantine' | 'manual';
export type EtlRouteMethod = 'auto' | 'regex' | 'manual';
export type EtlSourceType = 'account_62' | 'account_51';

export interface IEtlEntry {
  id: string;
  doc_date: string;
  document: string | null;
  analytics_dt: string | null;
  analytics_kt: string | null;
  debit_account: string | null;
  credit_account: string | null;
  amount: number;
  doc_type: EtlDocType;
  counterparty_name: string | null;
  contract_name: string | null;
  payment_purpose: string | null;
  source_type: EtlSourceType;
  status: EtlEntryStatus;
  routed_project_id: string | null;
  routed_category_id: string | null;
  route_method: EtlRouteMethod | null;
  route_log: string | null;
  import_batch_id: string;
  imported_at: string;
  routed_at: string | null;
  created_at: string;
}

export interface IEtlContractMap {
  id: string;
  counterparty_name: string;
  contract_name: string;
  project_id: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface IEtlPaymentMask {
  id: string;
  pattern: string;
  description: string | null;
  category_id: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IEtlImportResult {
  total: number;
  routed: number;
  quarantine: number;
  batchId: string;
}
