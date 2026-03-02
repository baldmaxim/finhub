import { supabase } from '../config/supabase';
import type { BdrSubEntry, BdrSubEntryFormData, BdrSubType } from '../types/bdr';

export async function getSubEntries(
  subType: BdrSubType,
  projectId?: string,
  year?: number
): Promise<BdrSubEntry[]> {
  let query = supabase
    .from('bdr_sub_entries')
    .select('*')
    .eq('sub_type', subType)
    .order('entry_date', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }
  if (year) {
    query = query
      .gte('entry_date', `${year}-01-01`)
      .lte('entry_date', `${year}-12-31`);
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

export async function importSubEntries(entries: BdrSubEntryFormData[]): Promise<number> {
  if (entries.length === 0) return 0;

  const { data, error } = await supabase
    .from('bdr_sub_entries')
    .insert(entries)
    .select('id');

  if (error) throw error;
  return data?.length ?? 0;
}
