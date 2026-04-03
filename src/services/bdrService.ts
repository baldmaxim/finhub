import { supabase } from '../config/supabase';
import type { BdrEntry, BdrEntryType } from '../types/bdr';

export async function getEntries(year: number, entryType: BdrEntryType, projectId?: string): Promise<BdrEntry[]> {
  let query = supabase
    .from('bdr_entries')
    .select('*')
    .eq('year', year)
    .eq('entry_type', entryType)
    .limit(10000);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as BdrEntry[];
}

export async function upsertBatch(
  entries: Array<{
    row_code: string;
    year: number;
    month: number;
    amount: number;
    entry_type: BdrEntryType;
    project_id?: string;
  }>
): Promise<void> {
  if (entries.length === 0) return;

  const withTimestamp = entries.map((e) => ({
    ...e,
    updated_at: new Date().toISOString(),
  }));

  const hasProject = entries.some((e) => e.project_id);
  const onConflict = hasProject
    ? 'row_code,year,month,entry_type,project_id'
    : 'row_code,year,month,entry_type';

  const { error } = await supabase
    .from('bdr_entries')
    .upsert(withTimestamp, { onConflict });

  if (error) throw error;
}

/** Итого «Всего СМР по проекту» за все годы — через RPC */
export async function getSmrAllYearsTotal(projectId?: string): Promise<number> {
  const { data, error } = await supabase
    .rpc('bdr_smr_all_years_total', {
      p_project_id: projectId || null,
    });

  if (error) throw error;
  return Number(data) || 0;
}

/** Кумулятивные суммы revenue_smr (план и факт) за все годы до указанного — через RPC */
export async function getRevenueCumulativeBefore(
  year: number,
  projectId?: string
): Promise<{ plan: number; fact: number }> {
  const { data, error } = await supabase
    .rpc('bdr_revenue_cumulative_before', {
      p_year: year,
      p_project_id: projectId || null,
    });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    plan: Number(row?.plan_total) || 0,
    fact: Number(row?.fact_total) || 0,
  };
}

/** Помесячные итоги СМР за год — через RPC */
export async function getSmrTotalsByMonth(year: number, projectId?: string): Promise<{ withoutVat: Record<number, number>; withVat: Record<number, number> }> {
  const { data, error } = await supabase
    .rpc('bdr_smr_totals_by_month', {
      p_year: year,
      p_project_id: projectId || null,
    });

  if (error) throw error;

  const withoutVat: Record<number, number> = {};
  const withVat: Record<number, number> = {};
  for (const row of (data || [])) {
    withoutVat[row.month] = Number(row.without_vat) || 0;
    withVat[row.month] = Number(row.with_vat) || 0;
  }
  return { withoutVat, withVat };
}
