import { useState, useEffect, useCallback } from 'react';
import * as etlService from '../services/etlService';
import * as projectsService from '../services/projectsService';
import { getCategories } from '../services/bddsService';
import type { IEtlContractMap, IEtlPaymentMask } from '../types/etl';
import type { Project } from '../types/projects';
import type { BddsCategory } from '../types/bdds';

interface IUseEtlMappingResult {
  contracts: IEtlContractMap[];
  paymentMasks: IEtlPaymentMask[];
  projects: Project[];
  categories: BddsCategory[];
  loading: boolean;
  error: string | null;
  saveContract: (counterparty: string, contract: string, projectId: string, note?: string) => Promise<void>;
  removeContract: (id: string) => Promise<void>;
  saveMask: (mask: Omit<IEtlPaymentMask, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => Promise<void>;
  removeMask: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

export function useEtlMapping(): IUseEtlMappingResult {
  const [contracts, setContracts] = useState<IEtlContractMap[]>([]);
  const [paymentMasks, setPaymentMasks] = useState<IEtlPaymentMask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<BddsCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [ct, pm, proj, cats] = await Promise.all([
        etlService.getContractMaps(),
        etlService.getPaymentMasks(),
        projectsService.getProjects(),
        getCategories(),
      ]);
      setContracts(ct);
      setPaymentMasks(pm);
      setProjects(proj.filter((p) => p.is_active));
      setCategories(cats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveContract = useCallback(async (counterparty: string, contract: string, projectId: string, note?: string) => {
    await etlService.upsertContractMap(counterparty, contract, projectId, note);
    await loadData();
  }, [loadData]);

  const removeContract = useCallback(async (id: string) => {
    await etlService.deleteContractMap(id);
    await loadData();
  }, [loadData]);

  const saveMask = useCallback(async (mask: Omit<IEtlPaymentMask, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => {
    await etlService.upsertPaymentMask(mask);
    await loadData();
  }, [loadData]);

  const removeMask = useCallback(async (id: string) => {
    await etlService.deletePaymentMask(id);
    await loadData();
  }, [loadData]);

  return {
    contracts,
    paymentMasks,
    projects,
    categories,
    loading,
    error,
    saveContract,
    removeContract,
    saveMask,
    removeMask,
    reload: loadData,
  };
}
