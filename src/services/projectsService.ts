import { supabase } from '../config/supabase';
import type { Project, ProjectFormData } from '../types/projects';

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .neq('code', 'OBSCHEHOZ')
    .order('code');

  if (error) throw error;
  return data as Project[];
}

export async function createProject(formData: ProjectFormData): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      code: formData.code,
      name: formData.name,
      related_names: formData.related_names,
      description: formData.description,
      is_active: formData.is_active,
      start_date: formData.start_date,
      gu_return_date: formData.gu_return_date,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Project;
}

export async function updateProject(
  id: string,
  formData: ProjectFormData
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update({
      code: formData.code,
      name: formData.name,
      related_names: formData.related_names,
      description: formData.description,
      is_active: formData.is_active,
      start_date: formData.start_date,
      gu_return_date: formData.gu_return_date,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Project;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
