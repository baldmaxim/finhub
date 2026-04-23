export type EtlDocType = 'receipt' | 'debt_correction' | 'internal_transfer' | 'expense' | 'other';
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
  bank_account_id: string | null;
  target_bank_account_id: string | null;
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
  detectedBankAccount?: { id: string; account_number: string; bank_name: string } | null;
  selectedMismatch?: boolean;
}

export interface IBankAccount {
  id: string;
  account_number: string;
  bank_name: string;
  bik: string;
  description: string | null;
  is_active: boolean;
  is_obs: boolean;
  created_at: string;
  updated_at: string;
}

export interface IEtlRoutingRule {
  id: string;
  priority: number;
  match_doc_type: EtlDocType | null;
  match_is_obs: boolean | null;
  match_credit_subaccount: string | null;
  category_id: string | null;
  create_mirror_expense: boolean;
  skip_bdds: boolean;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface IBankAccountBalance {
  id: string;
  account_number: string;
  bank_name: string;
  bik: string;
  description: string | null;
  is_active: boolean;
  inflows: number;
  expenses: number;
  transfers_in: number;
  transfers_out: number;
  balance: number;
}
