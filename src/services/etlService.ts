import { supabase } from '../config/supabase';
import type { IEtlEntry, IEtlContractMap, IEtlPaymentMask } from '../types/etl';

const BATCH_SIZE = 500;

// === Записи (проводки) ===

export async function getEntries(status?: string, batchId?: string): Promise<IEtlEntry[]> {
  let query = supabase
    .from('etl_1c_entries')
    .select('*')
    .order('doc_date', { ascending: false });

  if (status) query = query.eq('status', status);
  if (batchId) query = query.eq('import_batch_id', batchId);

  const allData: IEtlEntry[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await query.range(from, from + BATCH_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData.push(...(data as IEtlEntry[]));
    if (data.length < BATCH_SIZE) break;
    from += BATCH_SIZE;
  }

  return allData;
}

export async function insertEntries(
  entries: Array<{
    doc_date: string;
    document: string | null;
    analytics_dt: string | null;
    analytics_kt: string | null;
    debit_account: string | null;
    credit_account: string | null;
    amount: number;
    doc_type: string;
    counterparty_name: string | null;
    contract_name: string | null;
    import_batch_id: string;
  }>
): Promise<void> {
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('etl_1c_entries').insert(batch);
    if (error) throw error;
  }
}

export async function routeBatch(batchId: string): Promise<{ routed: number; quarantine: number }> {
  const { data, error } = await supabase.rpc('etl_route_batch', { p_batch_id: batchId });
  if (error) throw error;
  return data as { routed: number; quarantine: number };
}

export async function manualRoute(
  entryId: string,
  projectId: string,
  categoryId: string,
  saveRule: boolean
): Promise<void> {
  const { error } = await supabase.rpc('etl_manual_route', {
    p_entry_id: entryId,
    p_project_id: projectId,
    p_category_id: categoryId,
    p_save_rule: saveRule,
  });
  if (error) throw error;
}

export async function rerouteQuarantine(): Promise<{ routed: number; quarantine: number }> {
  const { data, error } = await supabase.rpc('etl_reroute_quarantine', {});
  if (error) throw error;
  return data as { routed: number; quarantine: number };
}

export async function syncBdds(): Promise<{ deleted: number; inserted: number }> {
  const { data, error } = await supabase.rpc('etl_sync_bdds', {});
  if (error) throw error;
  return data as { deleted: number; inserted: number };
}

// === Маппинг договоров ===

export async function getContractMaps(): Promise<IEtlContractMap[]> {
  const { data, error } = await supabase
    .from('etl_1c_contract_map')
    .select('*')
    .order('counterparty_name');
  if (error) throw error;
  return data as IEtlContractMap[];
}

function cleanText(s: string): string {
  return s.replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function upsertContractMap(
  counterpartyName: string,
  contractName: string,
  projectId: string,
  note?: string
): Promise<void> {
  const cleanCounterparty = cleanText(counterpartyName);
  const cleanContract = cleanText(contractName);

  const { data: existing } = await supabase
    .from('etl_1c_contract_map')
    .select('id')
    .eq('counterparty_name', cleanCounterparty)
    .eq('contract_name', cleanContract)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('etl_1c_contract_map')
      .update({
        project_id: projectId,
        note: note || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('etl_1c_contract_map')
      .insert({
        counterparty_name: cleanCounterparty,
        contract_name: cleanContract,
        project_id: projectId,
        note: note || null,
      });
    if (error) throw error;
  }
}

export async function deleteContractMap(id: string): Promise<void> {
  const { error } = await supabase.from('etl_1c_contract_map').delete().eq('id', id);
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
