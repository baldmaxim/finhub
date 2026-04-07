import { supabase } from '../config/supabase';
import type { IBankAccount, IBankAccountBalance } from '../types/etl';

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

export async function getBalances(): Promise<IBankAccountBalance[]> {
  const { data, error } = await supabase
    .from('bank_account_balances')
    .select('*');
  if (error) throw error;
  return data as IBankAccountBalance[];
}
