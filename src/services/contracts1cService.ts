import { supabase } from '../config/supabase';
import type { IContract1c, IContract1cEnrichData, IContract1cImportRow, IContract1cImportResult } from '../types/contracts1c';
import { checkContractBudget } from './bdrBudgetControlService';

/** Получить все договоры 1С */
export async function getContracts(projectId?: string): Promise<IContract1c[]> {
  let query = supabase
    .from('contracts_1c')
    .select('*')
    .order('imported_at', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as IContract1c[];
}

/** Получить договоры без фильтра по проекту (включая непривязанные) */
export async function getAllContracts(): Promise<IContract1c[]> {
  const { data, error } = await supabase
    .from('contracts_1c')
    .select('*')
    .order('imported_at', { ascending: false });

  if (error) throw error;
  return data as IContract1c[];
}

/** Массовый UPSERT через RPC */
export async function upsertBatch(
  rows: IContract1cImportRow[],
  batchId: string
): Promise<IContract1cImportResult> {
  const { data, error } = await supabase.rpc('contracts_1c_upsert_batch', {
    p_batch_id: batchId,
    p_rows: rows,
  });

  if (error) throw error;
  return { ...data, batchId } as IContract1cImportResult;
}

/** Обогащение договора ручными полями + проверка лимита БДР */
export async function enrichContract(
  id: string,
  enrichData: IContract1cEnrichData
): Promise<{ success: boolean; budgetMessage?: string }> {
  // Получаем текущий договор для проверки суммы
  const { data: contract, error: fetchError } = await supabase
    .from('contracts_1c')
    .select('amount')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  // Проверяем лимит БДР (Блок 4)
  const budgetCheck = await checkContractBudget(
    enrichData.bdr_sub_type,
    Number(contract.amount),
    enrichData.project_id,
  );

  if (!budgetCheck.allowed) {
    // Hard Block — статус «Превышен лимит»
    await supabase
      .from('contracts_1c')
      .update({
        ...enrichData,
        status: 'overlimit',
        enriched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return { success: false, budgetMessage: budgetCheck.message };
  }

  // Активация договора
  const { error } = await supabase
    .from('contracts_1c')
    .update({
      ...enrichData,
      status: 'active',
      enriched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

/** Обновить статус после перепроверки (amount_changed → active) */
export async function revalidateContract(id: string): Promise<{ success: boolean; budgetMessage?: string }> {
  const { data: contract, error: fetchError } = await supabase
    .from('contracts_1c')
    .select('amount, project_id, bdr_sub_type')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;
  if (!contract.project_id || !contract.bdr_sub_type) {
    return { success: false, budgetMessage: 'Договор не привязан к проекту и статье БДР' };
  }

  const budgetCheck = await checkContractBudget(
    contract.bdr_sub_type,
    Number(contract.amount),
    contract.project_id,
  );

  if (!budgetCheck.allowed) {
    await supabase
      .from('contracts_1c')
      .update({ status: 'overlimit', updated_at: new Date().toISOString() })
      .eq('id', id);
    return { success: false, budgetMessage: budgetCheck.message };
  }

  const { error } = await supabase
    .from('contracts_1c')
    .update({
      status: 'active',
      prev_amount: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

/** Сохранить ссылку на созданный БДР-договор */
export async function linkBdrContract(id: string, bdrContractId: string): Promise<void> {
  const { error } = await supabase
    .from('contracts_1c')
    .update({ bdr_contract_id: bdrContractId, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

/** Удалить договор */
export async function deleteContract(id: string): Promise<void> {
  const { error } = await supabase
    .from('contracts_1c')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
