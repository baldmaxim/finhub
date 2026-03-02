import { useState, useEffect, useCallback } from 'react';
import type { BdrSubEntry, BdrSubEntryFormData, BdrSubType } from '../types/bdr';
import type { Project } from '../types/projects';
import * as bdrSubService from '../services/bdrSubService';
import * as projectsService from '../services/projectsService';

interface IUseBdrSubResult {
  entries: BdrSubEntry[];
  projects: Project[];
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  selectedMonth: number | null;
  setSelectedMonth: (month: number | null) => void;
  loading: boolean;
  error: string | null;
  createEntry: (data: BdrSubEntryFormData) => Promise<void>;
  updateEntry: (id: string, data: Partial<BdrSubEntryFormData>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  importFromExcel: (data: BdrSubEntryFormData[]) => Promise<void>;
  reload: () => Promise<void>;
}

export function useBdrSub(subType: BdrSubType, year: number): IUseBdrSubResult {
  const [entries, setEntries] = useState<BdrSubEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(
    subType === 'overhead_labor' ? new Date().getMonth() + 1 : null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [projectsData, entriesData] = await Promise.all([
        projectsService.getProjects(),
        bdrSubService.getSubEntries(
          subType,
          selectedProjectId ?? undefined,
          year,
          selectedMonth ?? undefined
        ),
      ]);

      setProjects(projectsData.filter((p) => p.is_active));
      setEntries(entriesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [subType, year, selectedProjectId, selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createEntry = useCallback(
    async (data: BdrSubEntryFormData) => {
      await bdrSubService.createSubEntry(data);
      await loadData();
    },
    [loadData]
  );

  const updateEntry = useCallback(
    async (id: string, data: Partial<BdrSubEntryFormData>) => {
      await bdrSubService.updateSubEntry(id, data);
      await loadData();
    },
    [loadData]
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      await bdrSubService.deleteSubEntry(id);
      await loadData();
    },
    [loadData]
  );

  const importFromExcel = useCallback(
    async (data: BdrSubEntryFormData[]) => {
      try {
        await bdrSubService.importSubEntries(data);
      } finally {
        await loadData();
      }
    },
    [loadData]
  );

  return {
    entries,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    selectedMonth,
    setSelectedMonth,
    loading,
    error,
    createEntry,
    updateEntry,
    deleteEntry,
    importFromExcel,
    reload: loadData,
  };
}
