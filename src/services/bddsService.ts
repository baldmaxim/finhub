import { supabase } from '../config/supabase';
import type { BddsCategory, BddsEntry, EntryType } from '../types/bdds';

export async function getCategories(): Promise<BddsCategory[]> {
  const { data, error } = await supabase
    .from('bdds_categories')
    .select('*')
    .order('section_code')
    .order('sort_order');

  if (error) throw error;
  return data as BddsCategory[];
}

export async function getEntries(year: number, entryType: EntryType, projectId?: string): Promise<BddsEntry[]> {
  let query = supabase
    .from('bdds_entries')
    .select('*')
    .eq('year', year)
    .eq('entry_type', entryType);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query.limit(10000);
  if (error) throw error;
  return data as BddsEntry[];
}

export async function upsertEntry(
  categoryId: string,
  year: number,
  month: number,
  amount: number,
  entryType: EntryType
): Promise<void> {
  const { error } = await supabase
    .from('bdds_entries')
    .upsert(
      {
        category_id: categoryId,
        year,
        month,
        amount,
        entry_type: entryType,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'category_id,year,month,entry_type' }
    );

  if (error) throw error;
}

export async function upsertBatch(
  entries: Array<{
    category_id: string;
    year: number;
    month: number;
    amount: number;
    entry_type: EntryType;
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
    ? 'category_id,year,month,entry_type,project_id'
    : 'category_id,year,month,entry_type';

  const { error } = await supabase
    .from('bdds_entries')
    .upsert(withTimestamp, { onConflict });

  if (error) throw error;
}
