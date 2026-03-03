import { supabase } from '../config/supabase';
import type { ActualExecutionEntry, ActualExecutionTotals } from '../types/actualExecution';

export async function getEntries(projectId?: string): Promise<ActualExecutionEntry[]> {
  let query = supabase
    .from('actual_execution_entries')
    .select('*')
    .order('month_key', { ascending: true });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as ActualExecutionEntry[];
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

export async function getAggregatedTotals(year: number): Promise<ActualExecutionTotals> {
  const { data, error } = await supabase
    .from('actual_execution_entries')
    .select('month_key, ks_amount, fact_amount')
    .like('month_key', `${year}-%`);

  if (error) throw error;

  const ks: Record<number, number> = {};
  const fact: Record<number, number> = {};

  for (const e of data) {
    const month = parseInt(e.month_key.split('-')[1], 10);
    ks[month] = (ks[month] || 0) + Number(e.ks_amount);
    fact[month] = (fact[month] || 0) + Number(e.fact_amount);
  }

  return { ks, fact };
}
