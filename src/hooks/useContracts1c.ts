import { useState, useEffect, useCallback } from 'react';
import type { IContract1c, IContract1cEnrichData } from '../types/contracts1c';
import * as contracts1cService from '../services/contracts1cService';
import { createContractFrom1c } from '../services/contractsService';

interface IUseContracts1cResult {
  contracts: IContract1c[];
  loading: boolean;
  error: string | null;
  enrich: (id: string, data: IContract1cEnrichData) => Promise<{ success: boolean; budgetMessage?: string }>;
  revalidate: (id: string) => Promise<{ success: boolean; budgetMessage?: string }>;
  remove: (id: string) => Promise<void>;
  pushToBdr: (contract: IContract1c) => Promise<{ success: boolean; budgetMessage?: string }>;
  reload: () => Promise<void>;
}

export function useContracts1c(): IUseContracts1cResult {
  const [contracts, setContracts] = useState<IContract1c[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await contracts1cService.getAllContracts();
      setContracts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки договоров');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const enrich = useCallback(async (id: string, data: IContract1cEnrichData) => {
    const result = await contracts1cService.enrichContract(id, data);
    await load();
    return result;
  }, [load]);

  const revalidate = useCallback(async (id: string) => {
    const result = await contracts1cService.revalidateContract(id);
    await load();
    return result;
  }, [load]);

  const remove = useCallback(async (id: string) => {
    await contracts1cService.deleteContract(id);
    await load();
  }, [load]);

  const pushToBdr = useCallback(async (contract: IContract1c) => {
    const result = await createContractFrom1c(contract);
    if (result.success && result.contractId) {
      await contracts1cService.linkBdrContract(contract.id, result.contractId);
      await load();
    }
    return { success: result.success, budgetMessage: result.budgetMessage };
  }, [load]);

  return { contracts, loading, error, enrich, revalidate, remove, pushToBdr, reload: load };
}
