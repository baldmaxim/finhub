import { useState, useEffect, useCallback } from 'react';
import * as etlService from '../services/etlService';
import type { IEtlEntry } from '../types/etl';
import type { Project } from '../types/projects';
import type { BddsCategory } from '../types/bdds';
import * as projectsService from '../services/projectsService';
import { getCategories } from '../services/bddsService';

interface IUseEtlQuarantineResult {
  entries: IEtlEntry[];
  projects: Project[];
  categories: BddsCategory[];
  loading: boolean;
  error: string | null;
  resolveEntry: (
    entryId: string,
    projectId: string,
    categoryId: string,
    saveRule: boolean
  ) => Promise<void>;
  rerouteAll: () => Promise<{ routed: number; quarantine: number }>;
  reload: () => Promise<void>;
}

export function useEtlQuarantine(): IUseEtlQuarantineResult {
  const [entries, setEntries] = useState<IEtlEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<BddsCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [entryData, projData, catData] = await Promise.all([
        etlService.getEntries('quarantine'),
        projectsService.getProjects(),
        getCategories(),
      ]);
      setEntries(entryData);
      setProjects(projData.filter((p) => p.is_active));
      setCategories(catData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resolveEntry = useCallback(
    async (entryId: string, projectId: string, categoryId: string, saveRule: boolean) => {
      await etlService.manualRoute(entryId, projectId, categoryId, saveRule);
      await loadData();
    },
    [loadData]
  );

  const rerouteAll = useCallback(async () => {
    const result = await etlService.rerouteQuarantine();
    await loadData();
    return result;
  }, [loadData]);

  return {
    entries,
    projects,
    categories,
    loading,
    error,
    resolveEntry,
    rerouteAll,
    reload: loadData,
  };
}
