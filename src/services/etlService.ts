import { supabase } from '../config/supabase';
import type { IEtlEntry, IEtlContractMap, IEtlPaymentMask, IEtlRoutingRule } from '../types/etl';

const BATCH_SIZE = 500;

// === Записи (проводки) ===
//
// Пагинация — keyset (а не offset). Глубокий offset на 200 k+ строк уходит
// за statement_timeout и Supabase отдаёт 500. Курсор по (doc_date, id)
// использует индекс idx_etl_entries_doc_date_id (см. миграцию 057).

export async function getEntries(status?: string, batchId?: string): Promise<IEtlEntry[]> {
  const allData: IEtlEntry[] = [];
  let cursor: { docDate: string; id: string } | null = null;

  while (true) {
    const { data, error } = await supabase.rpc('etl_1c_entries_keyset', {
      p_status:      status  ?? null,
      p_batch_id:    batchId ?? null,
      p_min_date:    null,
      p_max_date:    null,
      p_cursor_date: cursor?.docDate ?? null,
      p_cursor_id:   cursor?.id      ?? null,
      p_limit:       BATCH_SIZE,
    });
    if (error) throw error;
    if (!data || data.length === 0) break;
    const rows = data as IEtlEntry[];
    allData.push(...rows);
    if (rows.length < BATCH_SIZE) break;
    const last = rows[rows.length - 1];
    cursor = { docDate: last.doc_date, id: last.id };
  }

  return allData;
}

// Серверная пагинация для страницы Импорт. Тянуть все 200k+ проводок
// одним keyset-обходом упирается в statement_timeout прокси (см. 057),
// поэтому UI работает страницами через .range(from, to).
export interface IEntriesPageFilters {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface IEntriesPage {
  rows: IEtlEntry[];
  total: number;
}

export async function getEntriesPage(
  page: number,
  pageSize: number,
  filters?: IEntriesPageFilters
): Promise<IEntriesPage> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from('etl_1c_entries')
    .select('*', { count: 'exact' })
    .order('doc_date', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);

  if (filters?.status)   q = q.eq('status', filters.status);
  if (filters?.dateFrom) q = q.gte('doc_date', filters.dateFrom);
  if (filters?.dateTo)   q = q.lte('doc_date', filters.dateTo);
  if (filters?.search) {
    const s = filters.search.replace(/[,()]/g, ' ').trim();
    if (s) {
      q = q.or(`counterparty_name.ilike.%${s}%,contract_name.ilike.%${s}%`);
    }
  }

  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: (data ?? []) as IEtlEntry[], total: count ?? 0 };
}

export interface IStatusCounts {
  total: number;
  pending: number;
  routed: number;
  quarantine: number;
  manual: number;
}

export async function getStatusCounts(
  filters?: Omit<IEntriesPageFilters, 'status'>
): Promise<IStatusCounts> {
  const { data, error } = await supabase.rpc('etl_get_status_counts', {
    p_date_from: filters?.dateFrom ?? null,
    p_date_to:   filters?.dateTo   ?? null,
    p_search:    filters?.search   ?? null,
  });
  if (error) throw error;
  return data as IStatusCounts;
}

export async function getEntriesForDateRange(
  minDate: string,
  maxDate: string
): Promise<Pick<IEtlEntry, 'doc_date' | 'amount' | 'counterparty_name' | 'contract_name' | 'debit_account' | 'document' | 'analytics_dt' | 'analytics_kt' | 'row_index'>[]> {
  type Row = Pick<IEtlEntry, 'doc_date' | 'amount' | 'counterparty_name' | 'contract_name' | 'debit_account' | 'document' | 'analytics_dt' | 'analytics_kt' | 'row_index'> & { id: string };
  const all: Row[] = [];
  let cursor: { docDate: string; id: string } | null = null;

  while (true) {
    const { data, error } = await supabase.rpc('etl_1c_entries_keyset', {
      p_status:      null,
      p_batch_id:    null,
      p_min_date:    minDate,
      p_max_date:    maxDate,
      p_cursor_date: cursor?.docDate ?? null,
      p_cursor_id:   cursor?.id      ?? null,
      p_limit:       BATCH_SIZE,
    });
    if (error) throw error;
    if (!data || data.length === 0) break;
    const rows = data as Row[];
    all.push(...rows);
    if (rows.length < BATCH_SIZE) break;
    const last = rows[rows.length - 1];
    cursor = { docDate: last.doc_date, id: last.id };
  }
  return all;
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
    payment_purpose?: string | null;
    source_type?: string;
    bank_account_id?: string | null;
    target_bank_account_id?: string | null;
    import_batch_id: string;
    row_index?: number;
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

export async function routePending(): Promise<{ routed: number; quarantine: number }> {
  // По аналогии с rerouteQuarantine — клиентский цикл по чанкам.
  // RPC etl_route_pending_chunk обрабатывает p_limit pending-строк за вызов.
  const session = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const CHUNK_SIZE = 2000;
  const MAX_ITERATIONS = 200;

  let totalRouted = 0;
  let totalQuarantine = 0;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    const { data, error } = await supabase.rpc('etl_route_pending_chunk', {
      p_limit:   CHUNK_SIZE,
      p_session: session,
    });
    if (error) throw error;
    const result = data as {
      routed: number;
      quarantine: number;
      processed: number;
      remaining: number;
    };
    totalRouted     += result.routed;
    totalQuarantine += result.quarantine;
    iterations += 1;
    if (result.processed === 0) break;
  }

  void syncBdds().catch((e) => {
    console.warn('[ETL] sync_bdds после route_pending не успел:', e);
  });

  return { routed: totalRouted, quarantine: totalQuarantine };
}

export async function rerouteQuarantine(): Promise<{ routed: number; quarantine: number }> {
  // С миграции 060 etl_reroute_quarantine — чанковая (по p_limit). Клиент
  // в цикле зовёт RPC с одной session, пока RPC не вернёт processed=0.
  // Каждый вызов укладывается в 60s прокси Supabase.
  const session = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const CHUNK_SIZE = 2000;
  const MAX_ITERATIONS = 50;

  let totalRouted = 0;
  let totalQuarantine = 0;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    const { data, error } = await supabase.rpc('etl_reroute_quarantine', {
      p_limit: CHUNK_SIZE,
      p_session: session,
    });
    if (error) throw error;
    const result = data as {
      routed: number;
      quarantine: number;
      processed: number;
      remaining: number;
    };
    totalRouted     += result.routed;
    totalQuarantine += result.quarantine;
    iterations += 1;
    if (result.processed === 0) break;
  }

  // sync_bdds + refresh_bank_balances запускаем в фоне после всех чанков.
  void syncBdds().catch((e) => {
    console.warn('[ETL] sync_bdds после reroute не успел:', e);
  });

  return { routed: totalRouted, quarantine: totalQuarantine };
}

export async function syncBdds(): Promise<{ deleted: number; inserted: number }> {
  const { data, error } = await supabase.rpc('etl_sync_bdds', {});
  if (error) throw error;
  void refreshBankBalances().catch((e) => {
    console.warn('[ETL] refresh_bank_balances не успел:', e);
  });
  return data as { deleted: number; inserted: number };
}

export async function refreshBankBalances(): Promise<void> {
  const { error } = await supabase.rpc('refresh_bank_balances', {});
  if (error) throw error;
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

// === Правила структурной маршрутизации ===

export async function getRoutingRules(): Promise<IEtlRoutingRule[]> {
  const { data, error } = await supabase
    .from('etl_routing_rules')
    .select('*')
    .order('priority');
  if (error) throw error;
  return data as IEtlRoutingRule[];
}

export async function upsertRoutingRule(
  rule: Omit<IEtlRoutingRule, 'created_at' | 'updated_at'> & { id?: string }
): Promise<void> {
  const { error } = await supabase
    .from('etl_routing_rules')
    .upsert({ ...rule, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function deleteRoutingRule(id: string): Promise<void> {
  const { error } = await supabase.from('etl_routing_rules').delete().eq('id', id);
  if (error) throw error;
}
