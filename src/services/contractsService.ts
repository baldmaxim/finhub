import { supabase } from '../config/supabase';
import type { IBdrContract, IBdrContractFormData, ContractStatus } from '../types/contracts';
import { checkContractBudget } from './bdrBudgetControlService';
import type { BdrSubType } from '../types/bdr';

/** Получить договоры по проекту */
export async function getContracts(projectId?: string): Promise<IBdrContract[]> {
  let query = supabase
    .from('bdr_contracts')
    .select('*')
    .order('created_at', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as IBdrContract[];
}

/** Создать договор с проверкой бюджета (Soft Commit) */
export async function createContract(
  data: IBdrContractFormData
): Promise<{ success: boolean; contract?: IBdrContract; budgetMessage?: string }> {
  // Проверяем остаток бюджета
  const budgetCheck = await checkContractBudget(
    data.bdr_sub_type,
    data.amount,
    data.project_id
  );

  if (!budgetCheck.allowed) {
    return {
      success: false,
      budgetMessage: budgetCheck.message,
    };
  }

  const { data: result, error } = await supabase
    .from('bdr_contracts')
    .insert({
      ...data,
      status: 'active' as ContractStatus,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return { success: true, contract: result as IBdrContract };
}

/** Обновить статус договора */
export async function updateContractStatus(
  id: string,
  status: ContractStatus
): Promise<void> {
  const { error } = await supabase
    .from('bdr_contracts')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

/** Обновить оплаченную сумму */
export async function updateAmountPaid(
  id: string,
  amountPaid: number
): Promise<void> {
  const { error } = await supabase
    .from('bdr_contracts')
    .update({ amount_paid: amountPaid, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

/** Согласовать сверхлимит */
export async function approveOverlimit(
  id: string,
  approvedBy: string
): Promise<void> {
  const { error } = await supabase
    .from('bdr_contracts')
    .update({
      overlimit_approved: true,
      overlimit_approved_by: approvedBy,
      overlimit_approved_at: new Date().toISOString(),
      status: 'active' as ContractStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

/** Получить сумму резервов (soft commit) по статье БДР */
export async function getCommittedAmount(
  projectId: string,
  subType: BdrSubType
): Promise<number> {
  const { data, error } = await supabase
    .from('bdr_contracts')
    .select('amount')
    .eq('project_id', projectId)
    .eq('bdr_sub_type', subType)
    .eq('status', 'active');

  if (error) throw error;
  return (data || []).reduce((sum, c) => sum + Number(c.amount), 0);
}

/** Создать договор БДР из 1С-договора */
export async function createContractFrom1c(
  contract: import('../types/contracts1c').IContract1c
): Promise<{ success: boolean; contractId?: string; budgetMessage?: string }> {
  if (!contract.project_id || !contract.bdr_sub_type) {
    return { success: false, budgetMessage: 'Договор 1С не привязан к проекту и статье БДР' };
  }

  const formData: IBdrContractFormData = {
    project_id: contract.project_id,
    bdr_sub_type: contract.bdr_sub_type as import('../types/bdr').BdrSubType,
    contract_number: contract.contract_number,
    contractor_name: contract.counterparty_name,
    amount: contract.amount,
    sign_date: contract.contract_date ?? undefined,
  };

  const result = await createContract(formData);
  if (!result.success) return { success: false, budgetMessage: result.budgetMessage };
  return { success: true, contractId: result.contract?.id };
}

/** Удалить договор */
export async function deleteContract(id: string): Promise<void> {
  const { error } = await supabase
    .from('bdr_contracts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
