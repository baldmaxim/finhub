import { supabase } from '../config/supabase';
import type {
  IKsPlanEntry,
  IKsPlanFormValues,
  IBddsAutoGenResult,
  IBddsContractStatus,
} from '../types/bddsAuto';

export async function getKsPlan(projectId: string, year: number): Promise<IKsPlanEntry[]> {
  const { data, error } = await supabase
    .from('bdds_ks_plan')
    .select('*')
    .eq('project_id', projectId)
    .eq('year', year)
    .order('month');

  if (error) throw error;
  return data as IKsPlanEntry[];
}

export async function upsertKsPlanEntry(entry: IKsPlanFormValues): Promise<IKsPlanEntry> {
  const { data, error } = await supabase
    .from('bdds_ks_plan')
    .upsert(
      { ...entry, updated_at: new Date().toISOString() },
      { onConflict: 'project_id,year,month' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as IKsPlanEntry;
}

export async function deleteKsPlanEntry(id: string): Promise<void> {
  const { error } = await supabase.from('bdds_ks_plan').delete().eq('id', id);
  if (error) throw error;
}

export async function generatePlanFromDossier(
  projectId: string,
  year: number
): Promise<IBddsAutoGenResult> {
  const { data, error } = await supabase.rpc('bdds_generate_plan_from_dossier', {
    p_project_id: projectId,
    p_year: year,
  });

  if (error) throw error;
  return data as IBddsAutoGenResult;
}

export async function getContractStatus(projectId: string): Promise<IBddsContractStatus> {
  const { data, error } = await supabase.rpc('bdds_get_contract_status', {
    p_project_id: projectId,
  });

  if (error) throw error;
  return data as IBddsContractStatus;
}
