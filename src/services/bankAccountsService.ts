import { supabase } from '../config/supabase';
import type { IBankAccount, IBankAccountBalance, IBankAccountMonthlyBalance } from '../types/etl';

export async function getAll(): Promise<IBankAccount[]> {
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .order('account_number');
  if (error) throw error;
  return data as IBankAccount[];
}

export async function getActive(): Promise<IBankAccount[]> {
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('is_active', true)
    .order('account_number');
  if (error) throw error;
  return data as IBankAccount[];
}

export async function upsert(
  account: Partial<IBankAccount> & { account_number: string; bank_name: string; bik: string }
): Promise<void> {
  const { error } = await supabase
    .from('bank_accounts')
    .upsert({ ...account, updated_at: new Date().toISOString() }, { onConflict: 'account_number' });
  if (error) throw error;
}

export async function remove(id: string): Promise<void> {
  const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
  if (error) throw error;
}

export async function updateOpeningBalance(
  accountId: string,
  openingBalance: number,
  openingDate: string
): Promise<void> {
  const { error } = await supabase
    .from('bank_accounts')
    .update({
      opening_balance: openingBalance,
      opening_date: openingDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId);
  if (error) throw error;
}

export async function getBalances(): Promise<IBankAccountBalance[]> {
  const { data, error } = await supabase
    .from('bank_account_balances')
    .select('*');
  if (error) throw error;
  return data as IBankAccountBalance[];
}

export async function getMonthlyBalances(accountId: string): Promise<IBankAccountMonthlyBalance[]> {
  const { data, error } = await supabase
    .from('bank_account_balances_monthly')
    .select('*')
    .eq('account_id', accountId)
    .order('month_start');
  if (error) throw error;
  return data as IBankAccountMonthlyBalance[];
}
