import { supabase } from '../config/supabase';
import type { ActualExecutionEntry, ActualExecutionTotals } from '../types/actualExecution';

export async function getEntries(projectId?: string): Promise<ActualExecutionEntry[]> {
  let query = supabase
    .from('actual_execution_entries')
    .select('*')
    .order('month_key', { ascending: true })
    .limit(10000);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as ActualExecutionEntry[];
}

export async function deleteEntriesByProjectAndMonths(
  projectId: string,
  monthKeys: string[]
): Promise<void> {
  if (monthKeys.length === 0) return;

  const { error } = await supabase
    .from('actual_execution_entries')
    .delete()
    .eq('project_id', projectId)
    .in('month_key', monthKeys);

  if (error) throw error;
}

export async function upsertEntries(
  entries: Array<{
    project_id: string;
    month_key: string;
    ks_amount: number;
    fact_amount: number;
  }>
): Promise<void> {
  if (entries.length === 0) return;

  const withTimestamp = entries.map((e) => ({
    ...e,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('actual_execution_entries')
    .upsert(withTimestamp, { onConflict: 'project_id,month_key' });

  if (error) throw error;
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('actual_execution_entries')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getAggregatedTotals(year: number, projectId?: string): Promise<{ withoutVat: ActualExecutionTotals; withVat: ActualExecutionTotals }> {
  let query = supabase
    .from('actual_execution_entries')
    .select('month_key, ks_amount, fact_amount')
    .like('month_key', `${year}-%`);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) throw error;

  const vatRate = year >= 2026 ? 22 : 20;
  const vatDivisor = (100 + vatRate) / 100;

  const ks: Record<number, number> = {};
  const fact: Record<number, number> = {};
  const ksVat: Record<number, number> = {};
  const factVat: Record<number, number> = {};

  for (const e of data) {
    const month = parseInt(e.month_key.split('-')[1], 10);
    const ksAmt = Number(e.ks_amount);
    const factAmt = Number(e.fact_amount);
    ks[month] = (ks[month] || 0) + ksAmt / vatDivisor;
    fact[month] = (fact[month] || 0) + factAmt / vatDivisor;
    ksVat[month] = (ksVat[month] || 0) + ksAmt;
    factVat[month] = (factVat[month] || 0) + factAmt;
  }

  return {
    withoutVat: { ks, fact },
    withVat: { ks: ksVat, fact: factVat },
  };
}
