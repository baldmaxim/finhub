import { supabase } from '../config/supabase';
import type { BdrSubEntry, BdrSubEntryFormData, BdrSubType } from '../types/bdr';
import { BDDS_PLAN_SUB_TYPES } from '../utils/bdrConstants';

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export async function getSubEntries(
  subType: BdrSubType,
  projectId?: string,
  yearFrom?: number,
  month?: number,
  yearTo?: number
): Promise<BdrSubEntry[]> {
  let query = supabase
    .from('bdr_sub_entries')
    .select('*')
    .eq('sub_type', subType)
    .order('entry_date', { ascending: false })
    .limit(10000);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }
  if (yearFrom) {
    const endYear = yearTo ?? yearFrom;
    if (month && yearFrom === endYear) {
      const m = String(month).padStart(2, '0');
      query = query
        .gte('entry_date', `${yearFrom}-${m}-01`)
        .lte('entry_date', lastDayOfMonth(yearFrom, month));
    } else {
      query = query
        .gte('entry_date', `${yearFrom}-01-01`)
        .lte('entry_date', `${endYear}-12-31`);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as BdrSubEntry[];
}

export async function createSubEntry(data: BdrSubEntryFormData): Promise<BdrSubEntry> {
  const { data: result, error } = await supabase
    .from('bdr_sub_entries')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return result as BdrSubEntry;
}

export async function updateSubEntry(id: string, data: Partial<BdrSubEntryFormData>): Promise<BdrSubEntry> {
  const { data: result, error } = await supabase
    .from('bdr_sub_entries')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result as BdrSubEntry;
}

export async function deleteSubEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('bdr_sub_entries')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getSubTotalsByMonth(
  subType: BdrSubType,
  year: number,
  projectId?: string
): Promise<Record<number, number>> {
  const { data, error } = await supabase.rpc('bdr_sub_totals_by_month', {
    p_sub_type: subType,
    p_year: year,
    p_project_id: projectId || null,
  });

  if (error) throw error;

  const totals: Record<number, number> = {};
  for (const row of (data || [])) {
    totals[row.month] = Number(row.total) || 0;
  }
  return totals;
}

export async function getMultiSubTotalsByMonth(
  subTypes: BdrSubType[],
  year: number,
  projectId?: string
): Promise<Record<string, Record<number, number>>> {
  const { data, error } = await supabase.rpc('bdr_multi_sub_totals_by_month', {
    p_sub_types: subTypes,
    p_year: year,
    p_project_id: projectId || null,
  });

  if (error) throw error;

  const result: Record<string, Record<number, number>> = {};
  for (const row of (data || [])) {
    const st = row.sub_type as string;
    if (!result[st]) result[st] = {};
    result[st][row.month] = Number(row.total) || 0;
  }
  return result;
}

export async function deleteSubEntriesByPeriod(
  subType: BdrSubType,
  projectId: string | null,
  months: Array<{ year: number; month: number }>
): Promise<void> {
  for (const { year, month } of months) {
    const m = String(month).padStart(2, '0');
    let query = supabase
      .from('bdr_sub_entries')
      .delete()
      .eq('sub_type', subType)
      .gte('entry_date', `${year}-${m}-01`)
      .lte('entry_date', lastDayOfMonth(year, month));

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { error } = await query;
    if (error) throw error;
  }
}

export async function getFixedExpensesTotalsByMonth(
  year: number,
  projectId?: string
): Promise<Record<number, number>> {
  const { data, error } = await supabase.rpc('bdr_fixed_expenses_by_month', {
    p_year: year,
    p_project_id: projectId || null,
  });

  if (error) throw error;

  const totals: Record<number, number> = {};
  for (const row of (data || [])) {
    totals[row.month] = Number(row.total) || 0;
  }
  return totals;
}

export async function getSubTotalsForBdds(
  year: number,
  projectId?: string
): Promise<Record<string, Record<number, number>>> {
  // Текущий год + декабрь прошлого года (→ январь текущего)
  let q1 = supabase
    .from('bdr_sub_entries')
    .select('sub_type, entry_date, amount')
    .in('sub_type', BDDS_PLAN_SUB_TYPES)
    .gte('entry_date', `${year}-01-01`)
    .lte('entry_date', `${year}-12-31`);

  let q2 = supabase
    .from('bdr_sub_entries')
    .select('sub_type, entry_date, amount')
    .in('sub_type', BDDS_PLAN_SUB_TYPES)
    .gte('entry_date', `${year - 1}-12-01`)
    .lte('entry_date', `${year - 1}-12-31`);

  if (projectId) {
    q1 = q1.eq('project_id', projectId);
    q2 = q2.eq('project_id', projectId);
  }

  const [res1, res2] = await Promise.all([q1, q2]);
  if (res1.error) throw res1.error;
  if (res2.error) throw res2.error;

  const allData = [...(res1.data || []), ...(res2.data || [])];

  const result: Record<string, Record<number, number>> = {};
  for (const e of allData) {
    const st = e.sub_type as string;
    const d = new Date(e.entry_date);
    const origMonth = d.getMonth() + 1;
    const origYear = d.getFullYear();

    // Сдвиг +1 месяц
    let targetMonth: number;
    if (origYear === year - 1 && origMonth === 12) {
      targetMonth = 1;
    } else if (origYear === year && origMonth <= 11) {
      targetMonth = origMonth + 1;
    } else {
      continue; // декабрь текущего года → январь следующего (пропускаем)
    }

    if (!result[st]) result[st] = {};
    result[st][targetMonth] = (result[st][targetMonth] || 0) + Number(e.amount);
  }
  return result;
}

export async function importSubEntries(entries: BdrSubEntryFormData[]): Promise<number> {
  if (entries.length === 0) return 0;

  const cleaned = entries.map(({ project_id, ...rest }) =>
    project_id ? { project_id, ...rest } : rest
  );

  const { data, error } = await supabase
    .from('bdr_sub_entries')
    .insert(cleaned)
    .select('id');

  if (error) throw error;
  return data?.length ?? 0;
}
