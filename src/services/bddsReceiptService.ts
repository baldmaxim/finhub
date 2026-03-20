import { supabase } from '../config/supabase';
import type { BddsReceiptDetail, BddsReceiptImportRow } from '../types/bddsReceipt';
import type { MonthValues } from '../types/bdds';

export async function getReceiptDetails(
  projectId: string,
  categoryId: string,
  year: number
): Promise<BddsReceiptDetail[]> {
  const { data, error } = await supabase
    .from('bdds_receipt_details')
    .select('*')
    .eq('project_id', projectId)
    .eq('category_id', categoryId)
    .eq('year', year)
    .order('month')
    .order('row_number');

  if (error) throw error;
  return data as BddsReceiptDetail[];
}

export async function getReceiptTotalsByMonth(
  projectId: string,
  categoryId: string,
  year: number
): Promise<MonthValues> {
  const details = await getReceiptDetails(projectId, categoryId, year);
  const totals: MonthValues = {};
  for (const d of details) {
    totals[d.month] = (totals[d.month] || 0) + Number(d.amount);
  }
  return totals;
}

export async function importReceipts(
  projectId: string,
  categoryId: string,
  year: number,
  rows: BddsReceiptImportRow[]
): Promise<void> {
  // Удаляем старые записи за этот год
  const { error: delError } = await supabase
    .from('bdds_receipt_details')
    .delete()
    .eq('project_id', projectId)
    .eq('category_id', categoryId)
    .eq('year', year);

  if (delError) throw delError;

  if (rows.length === 0) return;

  const records = rows.map((r) => {
    const date = r.receipt_date ? new Date(r.receipt_date) : null;
    const month = date ? date.getMonth() + 1 : 1;
    return {
      project_id: projectId,
      category_id: categoryId,
      year,
      month,
      row_number: r.row_number,
      receipt_date: r.receipt_date,
      customer: r.customer,
      contract: r.contract,
      project_name: r.project_name,
      amount: r.amount,
    };
  });

  const { error } = await supabase
    .from('bdds_receipt_details')
    .insert(records);

  if (error) throw error;
}

export async function deleteReceipt(id: string): Promise<void> {
  const { error } = await supabase
    .from('bdds_receipt_details')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getReceiptFactTotals(
  year: number,
  projectId?: string
): Promise<Map<string, MonthValues>> {
  let query = supabase
    .from('bdds_receipt_details')
    .select('category_id, month, amount')
    .eq('year', year);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const result = new Map<string, MonthValues>();
  for (const row of (data ?? [])) {
    const catId = row.category_id as string;
    if (!result.has(catId)) result.set(catId, {});
    const m = result.get(catId)!;
    m[row.month as number] = (m[row.month as number] || 0) + Number(row.amount);
  }
  return result;
}

export async function deleteAllReceipts(
  projectId: string,
  categoryId: string,
  year: number
): Promise<void> {
  const { error } = await supabase
    .from('bdds_receipt_details')
    .delete()
    .eq('project_id', projectId)
    .eq('category_id', categoryId)
    .eq('year', year);

  if (error) throw error;
}
