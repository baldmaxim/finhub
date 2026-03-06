import { supabase } from '../config/supabase';
import type { BddsIncomeEntry, BddsIncomeNote } from '../types/bddsIncome';

export async function getEntries(projectId?: string): Promise<BddsIncomeEntry[]> {
  let query = supabase.from('bdds_income_entries').select('*').limit(10000);
  if (projectId) {
    query = query.eq('project_id', projectId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as BddsIncomeEntry[];
}

export async function getNotes(projectId?: string): Promise<BddsIncomeNote[]> {
  let query = supabase.from('bdds_income_notes').select('*');
  if (projectId) {
    query = query.eq('project_id', projectId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as BddsIncomeNote[];
}

export async function upsertEntries(
  entries: Array<{
    project_id: string;
    work_type_code: string;
    month_key: string;
    amount: number;
  }>
): Promise<void> {
  if (entries.length === 0) return;

  const withTimestamp = entries.map((e) => ({
    ...e,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('bdds_income_entries')
    .upsert(withTimestamp, { onConflict: 'project_id,work_type_code,month_key' });

  if (error) throw error;
}

export async function upsertNotes(
  notes: Array<{
    project_id: string;
    work_type_code: string;
    note: string;
  }>
): Promise<void> {
  if (notes.length === 0) return;

  const withTimestamp = notes.map((n) => ({
    ...n,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('bdds_income_notes')
    .upsert(withTimestamp, { onConflict: 'project_id,work_type_code' });

  if (error) throw error;
}

export async function getIncomeTotalsByMonth(year: number, projectId?: string): Promise<Record<number, number>> {
  // Загружаем данные за год + декабрь предыдущего года (для расчёта января)
  const prevDec = `${year - 1}-12`;
  let query = supabase
    .from('bdds_income_entries')
    .select('work_type_code, month_key, amount')
    .or(`month_key.like.${year}-%,month_key.eq.${prevDec}`)
    .limit(10000);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) throw error;

  const SMR_CODES = [
    'prep_works', 'dewatering', 'earthworks', 'waterproofing',
    'monolith', 'masonry', 'facade', 'roofing', 'interior',
    'elevators', 'engineering', 'landscaping', 'external_networks',
  ];

  // Сгруппировать по (work_type_code, month_key)
  const byCodeMonth = new Map<string, number>();
  for (const e of data) {
    const key = `${e.work_type_code}|${e.month_key}`;
    byCodeMonth.set(key, (byCodeMonth.get(key) || 0) + Number(e.amount));
  }

  const getVal = (code: string, mk: string) => byCodeMonth.get(`${code}|${mk}`) || 0;
  const getSmrSum = (mk: string) => SMR_CODES.reduce((s, c) => s + getVal(c, mk), 0);

  const getPrevMk = (month: number): string => {
    if (month === 1) return prevDec;
    return `${year}-${String(month - 1).padStart(2, '0')}`;
  };

  // Формула: total_income[M] = total_smr[M-1] + advance_income[M]
  //   - advance_offset[M-1] - guarantee_retention[M-1] + guarantee_return[M]
  const totals: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    const mk = `${year}-${String(m).padStart(2, '0')}`;
    const prevMk = getPrevMk(m);
    totals[m] =
      getSmrSum(prevMk)
      + getVal('advance_income', mk)
      - getVal('advance_offset', prevMk)
      - getVal('guarantee_retention', prevMk)
      + getVal('guarantee_return', mk);
  }
  return totals;
}

export async function deleteProjectEntries(projectId: string): Promise<void> {
  const { error: e1 } = await supabase
    .from('bdds_income_entries')
    .delete()
    .eq('project_id', projectId);
  if (e1) throw e1;

  const { error: e2 } = await supabase
    .from('bdds_income_notes')
    .delete()
    .eq('project_id', projectId);
  if (e2) throw e2;
}
