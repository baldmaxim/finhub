import type { BdrSubType } from './bdr';

export type Contract1cStatus = 'new' | 'active' | 'overlimit' | 'amount_changed';
export type Contract1cType = 'supplier' | 'buyer';
export type AccountType = 'regular' | 'target_obs';

export interface IContract1c {
  id: string;
  guid_1c: string;
  inn: string | null;
  counterparty_name: string;
  contract_number: string;
  contract_date: string | null;
  amount: number;
  currency: string;
  contract_type: Contract1cType;
  status: Contract1cStatus;
  project_id: string | null;
  bdr_sub_type: BdrSubType | null;
  advance_percent: number | null;
  guarantee_percent: number | null;
  gencontract_percent: number | null;
  account_type: AccountType | null;
  prev_amount: number | null;
  bdr_contract_id: string | null;
  import_batch_id: string | null;
  imported_at: string;
  enriched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IContract1cEnrichData {
  project_id: string;
  bdr_sub_type: BdrSubType;
  advance_percent?: number;
  guarantee_percent?: number;
  gencontract_percent?: number;
  account_type?: AccountType;
}

export interface IContract1cImportRow {
  guid_1c: string;
  inn: string;
  counterparty_name: string;
  contract_number: string;
  contract_date: string | null;
  amount: number;
  currency: string;
  contract_type: string;
}

export interface IContract1cImportResult {
  inserted: number;
  updated: number;
  amount_changed: number;
  batchId: string;
}

export const CONTRACT_1C_STATUS_LABELS: Record<Contract1cStatus, string> = {
  new: 'Не привязан к БДР',
  active: 'Активен',
  overlimit: 'Превышен лимит',
  amount_changed: 'Изменена сумма',
};

export const CONTRACT_1C_STATUS_COLORS: Record<Contract1cStatus, string> = {
  new: 'error',
  active: 'success',
  overlimit: 'warning',
  amount_changed: 'warning',
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  regular: 'Обычный р/с',
  target_obs: 'Целевой ОБС',
};

/** Типы договоров из 1С */
export const CONTRACT_1C_TYPE_LABELS: Record<Contract1cType, string> = {
  supplier: 'С поставщиком',
  buyer: 'С покупателем',
};

/** Колонки Excel из 1С */
export const EXCEL_COLUMN_MAP: Record<string, keyof IContract1cImportRow> = {
  'GUID_1C': 'guid_1c',
  'ИНН_Контрагента': 'inn',
  'Наименование_Контрагента': 'counterparty_name',
  'Номер_Договора': 'contract_number',
  'Дата_Договора': 'contract_date',
  'Сумма_Договора': 'amount',
  'Валюта': 'currency',
  'Вид_Договора': 'contract_type',
};
