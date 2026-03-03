import { supabase } from '../config/supabase';
import type { BdrEntry, BdrEntryType } from '../types/bdr';

export async function getEntries(year: number, entryType: BdrEntryType, projectId?: string): Promise<BdrEntry[]> {
  let query = supabase
    .from('bdr_entries')
    .select('*')
    .eq('year', year)
    .eq('entry_type', entryType);

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

const SMR_CODES = [
  'prep_works', 'dewatering', 'earthworks', 'waterproofing',
  'monolith', 'masonry', 'facade', 'roofing', 'interior',
  'elevators', 'engineering', 'landscaping', 'external_networks',
];

/** Итого «Всего СМР по проекту» за все годы */
export async function getSmrAllYearsTotal(projectId?: string): Promise<number> {
  let query = supabase
    .from('bdds_income_entries')
    .select('amount')
    .in('work_type_code', SMR_CODES);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data.reduce((sum, e) => sum + Number(e.amount), 0);
}

/** Кумулятивные суммы revenue_smr (план и факт) за все годы до указанного */
export async function getRevenueCumulativeBefore(
  year: number,
  projectId?: string
): Promise<{ plan: number; fact: number }> {
  const maxMonthKey = `${year}-01`;

  // План: сумма SMR из bdds_income_entries за все месяцы до year-01
  let smrQuery = supabase
    .from('bdds_income_entries')
    .select('amount')
    .in('work_type_code', SMR_CODES)
    .lt('month_key', maxMonthKey);

  if (projectId) {
    smrQuery = smrQuery.eq('project_id', projectId);
  }

  const { data: smrData, error: smrError } = await smrQuery;
  if (smrError) throw smrError;

  const plan = smrData.reduce((sum, e) => sum + Number(e.amount), 0);

  // Факт: сумма ks_amount из actual_execution_entries за все месяцы до year-01
  let ksQuery = supabase
    .from('actual_execution_entries')
    .select('ks_amount')
    .lt('month_key', maxMonthKey);

  if (projectId) {
    ksQuery = ksQuery.eq('project_id', projectId);
  }

  const { data: ksData, error: ksError } = await ksQuery;
  if (ksError) throw ksError;

  const fact = ksData.reduce((sum, e) => sum + Number(e.ks_amount), 0);

  return { plan, fact };
}

export async function getSmrTotalsByMonth(year: number, projectId?: string): Promise<Record<number, number>> {
  let query = supabase
    .from('bdds_income_entries')
    .select('work_type_code, month_key, amount')
    .like('month_key', `${year}-%`)
    .in('work_type_code', SMR_CODES);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const totals: Record<number, number> = {};
  for (const e of data) {
    const month = parseInt(e.month_key.split('-')[1], 10);
    totals[month] = (totals[month] || 0) + Number(e.amount);
  }
  return totals;
}
