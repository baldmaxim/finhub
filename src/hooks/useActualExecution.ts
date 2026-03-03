import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ActualExecutionEntry } from '../types/actualExecution';
import type { Project } from '../types/projects';
import * as actualExecutionService from '../services/actualExecutionService';
import * as projectsService from '../services/projectsService';

interface IUseActualExecutionResult {
  entries: ActualExecutionEntry[];
  projects: Project[];
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  loading: boolean;
  error: string | null;
  importFromExcel: (
    projectId: string,
    data: Array<{ monthKey: string; ksAmount: number; factAmount: number }>
  ) => Promise<void>;
  addEntry: (entry: {
    project_id: string;
    month_key: string;
    ks_amount: number;
    fact_amount: number;
  }) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

export function useActualExecution(): IUseActualExecutionResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [allEntries, setAllEntries] = useState<ActualExecutionEntry[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [projectsData, entriesData] = await Promise.all([
        projectsService.getProjects(),
        actualExecutionService.getEntries(),
      ]);

      setProjects(projectsData.filter((p) => p.is_active));
      setAllEntries(entriesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const entries = useMemo(() => {
    if (!selectedProjectId) return allEntries;
    return allEntries.filter((e) => e.project_id === selectedProjectId);
  }, [allEntries, selectedProjectId]);

  const importFromExcel = useCallback(
    async (
      projectId: string,
      data: Array<{ monthKey: string; ksAmount: number; factAmount: number }>
    ) => {
      const entriesToUpsert = data.map((d) => ({
        project_id: projectId,
        month_key: d.monthKey,
        ks_amount: d.ksAmount,
        fact_amount: d.factAmount,
      }));

      await actualExecutionService.upsertEntries(entriesToUpsert);
      await loadData();
    },
    [loadData]
  );

  const addEntry = useCallback(
    async (entry: {
      project_id: string;
      month_key: string;
      ks_amount: number;
      fact_amount: number;
    }) => {
      await actualExecutionService.upsertEntries([entry]);
      await loadData();
    },
    [loadData]
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      await actualExecutionService.deleteEntry(id);
      await loadData();
    },
    [loadData]
  );

  return {
    entries,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    loading,
    error,
    importFromExcel,
    addEntry,
    deleteEntry,
    reload: loadData,
  };
}
