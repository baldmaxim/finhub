import { supabase } from '../config/supabase';
import type {
  IEtlTransaction,
  IEtlBankAccountMap,
  IEtlContractMap,
  IEtlCashflowItemMap,
  IEtlPaymentMask,
  EtlWalletType,
} from '../types/etl';

const BATCH_SIZE = 500;

// === Транзакции ===

export async function getTransactions(
  status?: string,
  batchId?: string
): Promise<IEtlTransaction[]> {
  let query = supabase
    .from('etl_1c_transactions')
    .select('*')
    .order('doc_date', { ascending: false });

  if (status) query = query.eq('status', status);
  if (batchId) query = query.eq('import_batch_id', batchId);

  const allData: IEtlTransaction[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await query.range(from, from + BATCH_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData.push(...(data as IEtlTransaction[]));
    if (data.length < BATCH_SIZE) break;
    from += BATCH_SIZE;
  }

  return allData;
}

export async function insertTransactions(
  transactions: Array<Omit<IEtlTransaction, 'id' | 'status' | 'routed_project_id' | 'routed_category_id' | 'routed_wallet_type' | 'route_method' | 'route_log' | 'imported_at' | 'routed_at' | 'created_at'>>
): Promise<void> {
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('etl_1c_transactions')
      .insert(batch);
    if (error) throw error;
  }
}

export async function routeBatch(batchId: string): Promise<{ routed: number; quarantine: number }> {
  const { data, error } = await supabase.rpc('etl_route_batch', { p_batch_id: batchId });
  if (error) throw error;
  return data as { routed: number; quarantine: number };
}

export async function manualRoute(
  transactionId: string,
  projectId: string,
  categoryId: string,
  saveRule: boolean
): Promise<void> {
  const { error } = await supabase.rpc('etl_manual_route', {
    p_transaction_id: transactionId,
    p_project_id: projectId,
    p_category_id: categoryId,
    p_save_rule: saveRule,
  });
  if (error) throw error;
}

// === Маппинг банковских счетов ===

export async function getBankAccountMaps(): Promise<IEtlBankAccountMap[]> {
  const { data, error } = await supabase
    .from('etl_1c_bank_account_map')
    .select('*')
    .order('account_name');
  if (error) throw error;
  return data as IEtlBankAccountMap[];
}

export async function upsertBankAccountMap(
  guid1c: string,
  accountName: string,
  walletType: EtlWalletType
): Promise<void> {
  const { error } = await supabase
    .from('etl_1c_bank_account_map')
    .upsert(
      { guid_1c: guid1c, account_name: accountName, wallet_type: walletType, updated_at: new Date().toISOString() },
      { onConflict: 'guid_1c' }
    );
  if (error) throw error;
}

export async function deleteBankAccountMap(id: string): Promise<void> {
  const { error } = await supabase.from('etl_1c_bank_account_map').delete().eq('id', id);
  if (error) throw error;
}

// === Маппинг договоров ===

export async function getContractMaps(): Promise<IEtlContractMap[]> {
  const { data, error } = await supabase
    .from('etl_1c_contract_map')
    .select('*')
    .order('contract_name');
  if (error) throw error;
  return data as IEtlContractMap[];
}

export async function upsertContractMap(
  guid1c: string,
  contractName: string,
  counterpartyInn: string,
  counterpartyName: string,
  projectId: string
): Promise<void> {
  const { error } = await supabase
    .from('etl_1c_contract_map')
    .upsert(
      {
        guid_1c: guid1c,
        contract_name: contractName,
        counterparty_inn: counterpartyInn,
        counterparty_name: counterpartyName,
        project_id: projectId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'guid_1c' }
    );
  if (error) throw error;
}

export async function deleteContractMap(id: string): Promise<void> {
  const { error } = await supabase.from('etl_1c_contract_map').delete().eq('id', id);
  if (error) throw error;
}

// === Маппинг статей ДДС ===

export async function getCashflowItemMaps(): Promise<IEtlCashflowItemMap[]> {
  const { data, error } = await supabase
    .from('etl_1c_cashflow_item_map')
    .select('*')
    .order('item_name');
  if (error) throw error;
  return data as IEtlCashflowItemMap[];
}

export async function upsertCashflowItemMap(
  guid1c: string,
  itemName: string,
  categoryId: string
): Promise<void> {
  const { error } = await supabase
    .from('etl_1c_cashflow_item_map')
    .upsert(
      { guid_1c: guid1c, item_name: itemName, category_id: categoryId, updated_at: new Date().toISOString() },
      { onConflict: 'guid_1c' }
    );
  if (error) throw error;
}

export async function deleteCashflowItemMap(id: string): Promise<void> {
  const { error } = await supabase.from('etl_1c_cashflow_item_map').delete().eq('id', id);
  if (error) throw error;
}

// === Маски назначений платежа ===

export async function getPaymentMasks(): Promise<IEtlPaymentMask[]> {
  const { data, error } = await supabase
    .from('etl_1c_payment_masks')
    .select('*')
    .order('priority');
  if (error) throw error;
  return data as IEtlPaymentMask[];
}

export async function upsertPaymentMask(
  mask: Omit<IEtlPaymentMask, 'id' | 'created_at' | 'updated_at'> & { id?: string }
): Promise<void> {
  const { error } = await supabase
    .from('etl_1c_payment_masks')
    .upsert({ ...mask, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function deletePaymentMask(id: string): Promise<void> {
  const { error } = await supabase.from('etl_1c_payment_masks').delete().eq('id', id);
  if (error) throw error;
}
