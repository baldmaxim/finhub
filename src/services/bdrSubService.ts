import { supabase } from '../config/supabase';
import type { BdrSubEntry, BdrSubEntryFormData, BdrSubType } from '../types/bdr';

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export async function getSubEntries(
  subType: BdrSubType,
  projectId?: string,
  year?: number,
  month?: number
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
  if (year) {
    if (month) {
      const m = String(month).padStart(2, '0');
      query = query
        .gte('entry_date', `${year}-${m}-01`)
        .lte('entry_date', lastDayOfMonth(year, month));
    } else {
      query = query
        .gte('entry_date', `${year}-01-01`)
        .lte('entry_date', `${year}-12-31`);
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
  let query = supabase
    .from('bdr_sub_entries')
    .select('entry_date, amount')
    .eq('sub_type', subType)
    .gte('entry_date', `${year}-01-01`)
    .lte('entry_date', `${year}-12-31`);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const totals: Record<number, number> = {};
  for (const e of data) {
    const month = new Date(e.entry_date).getMonth() + 1;
    totals[month] = (totals[month] || 0) + Number(e.amount);
  }
  return totals;
}

export async function getMultiSubTotalsByMonth(
  subTypes: BdrSubType[],
  year: number,
  projectId?: string
): Promise<Record<string, Record<number, number>>> {
  let query = supabase
    .from('bdr_sub_entries')
    .select('sub_type, entry_date, amount')
    .in('sub_type', subTypes)
    .gte('entry_date', `${year}-01-01`)
    .lte('entry_date', `${year}-12-31`);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const result: Record<string, Record<number, number>> = {};
  for (const e of data) {
    const st = e.sub_type as string;
    if (!result[st]) result[st] = {};
    const month = new Date(e.entry_date).getMonth() + 1;
    result[st][month] = (result[st][month] || 0) + Number(e.amount);
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
  let query = supabase
    .from('bdr_sub_entries')
    .select('entry_date, amount, description')
    .eq('sub_type', 'fixed_expenses')
    .gte('entry_date', `${year}-01-01`)
    .lte('entry_date', `${year}-12-31`);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const totals: Record<number, number> = {};
  for (const e of data) {
    const month = new Date(e.entry_date).getMonth() + 1;
    const amount = Number(e.amount) || 0;
    const ofz = Number(e.description) || 0;
    const value = ofz ? amount / ofz : amount;
    totals[month] = (totals[month] || 0) + value;
  }
  return totals;
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
