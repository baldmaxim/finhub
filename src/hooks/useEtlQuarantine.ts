import { useState, useEffect, useCallback } from 'react';
import * as etlService from '../services/etlService';
import type { IEtlTransaction } from '../types/etl';
import type { Project } from '../types/projects';
import type { BddsCategory } from '../types/bdds';
import * as projectsService from '../services/projectsService';
import { getCategories } from '../services/bddsService';

interface IUseEtlQuarantineResult {
  transactions: IEtlTransaction[];
  projects: Project[];
  categories: BddsCategory[];
  loading: boolean;
  error: string | null;
  resolveTransaction: (
    transactionId: string,
    projectId: string,
    categoryId: string,
    saveRule: boolean
  ) => Promise<void>;
  reload: () => Promise<void>;
}

export function useEtlQuarantine(): IUseEtlQuarantineResult {
  const [transactions, setTransactions] = useState<IEtlTransaction[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<BddsCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [txData, projData, catData] = await Promise.all([
        etlService.getTransactions('quarantine'),
        projectsService.getProjects(),
        getCategories(),
      ]);
      setTransactions(txData);
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

  const resolveTransaction = useCallback(
    async (transactionId: string, projectId: string, categoryId: string, saveRule: boolean) => {
      await etlService.manualRoute(transactionId, projectId, categoryId, saveRule);
      await loadData();
    },
    [loadData]
  );

  return {
    transactions,
    projects,
    categories,
    loading,
    error,
    resolveTransaction,
    reload: loadData,
  };
}
