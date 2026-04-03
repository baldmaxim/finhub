export type EtlDocType = 'receipt' | 'debt_correction';
export type EtlTransactionStatus = 'pending' | 'routed' | 'quarantine' | 'manual';
export type EtlWalletType = 'free_cash' | 'obs';
export type EtlRouteMethod = 'guid_map' | 'regex_mask' | 'manual';

export interface IEtlTransaction {
  id: string;
  doc_type: EtlDocType;
  doc_date: string;
  amount: number;
  counterparty_inn: string | null;
  counterparty_name: string | null;
  contract_guid: string | null;
  contract_name: string | null;
  bank_account_guid: string | null;
  bank_account_name: string | null;
  cashflow_item_guid: string | null;
  cashflow_item_name: string | null;
  payment_purpose: string | null;
  sub_contract_guid: string | null;
  sub_contract_name: string | null;
  status: EtlTransactionStatus;
  routed_project_id: string | null;
  routed_category_id: string | null;
  routed_wallet_type: EtlWalletType | null;
  route_method: EtlRouteMethod | null;
  route_log: string | null;
  import_batch_id: string | null;
  imported_at: string;
  routed_at: string | null;
  created_at: string;
}

export interface IEtlBankAccountMap {
  id: string;
  guid_1c: string;
  account_name: string | null;
  wallet_type: EtlWalletType;
  created_at: string;
  updated_at: string;
}

export interface IEtlContractMap {
  id: string;
  guid_1c: string;
  contract_name: string | null;
  counterparty_inn: string | null;
  counterparty_name: string | null;
  project_id: string;
  created_at: string;
  updated_at: string;
}

export interface IEtlCashflowItemMap {
  id: string;
  guid_1c: string;
  item_name: string | null;
  category_id: string;
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

/** Строка из Excel-отчёта 1С до парсинга в транзакцию */
export interface IEtlRawRow {
  docType: EtlDocType;
  docDate: string;
  amount: number;
  counterpartyInn: string;
  counterpartyName: string;
  contractGuid: string;
  contractName: string;
  bankAccountGuid: string;
  bankAccountName: string;
  cashflowItemGuid: string;
  cashflowItemName: string;
  paymentPurpose: string;
  subContractGuid: string;
  subContractName: string;
}

export interface IEtlImportResult {
  total: number;
  routed: number;
  quarantine: number;
  batchId: string;
}

export interface IEtlRouteResult {
  status: 'routed' | 'quarantine';
  project_id?: string;
  category_id?: string;
  log?: string;
  error?: string;
}
