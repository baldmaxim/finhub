import { useState, useEffect, useCallback } from 'react';
import * as etlService from '../services/etlService';
import * as projectsService from '../services/projectsService';
import { getCategories } from '../services/bddsService';
import type {
  IEtlBankAccountMap,
  IEtlContractMap,
  IEtlCashflowItemMap,
  IEtlPaymentMask,
  EtlWalletType,
} from '../types/etl';
import type { Project } from '../types/projects';
import type { BddsCategory } from '../types/bdds';

interface IUseEtlMappingResult {
  bankAccounts: IEtlBankAccountMap[];
  contracts: IEtlContractMap[];
  cashflowItems: IEtlCashflowItemMap[];
  paymentMasks: IEtlPaymentMask[];
  projects: Project[];
  categories: BddsCategory[];
  loading: boolean;
  error: string | null;
  // Банковские счета
  saveBankAccount: (guid: string, name: string, walletType: EtlWalletType) => Promise<void>;
  removeBankAccount: (id: string) => Promise<void>;
  // Договоры
  saveContract: (guid: string, name: string, inn: string, counterparty: string, projectId: string) => Promise<void>;
  removeContract: (id: string) => Promise<void>;
  // Статьи ДДС
  saveCashflowItem: (guid: string, name: string, categoryId: string) => Promise<void>;
  removeCashflowItem: (id: string) => Promise<void>;
  // Маски
  saveMask: (mask: Omit<IEtlPaymentMask, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => Promise<void>;
  removeMask: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

export function useEtlMapping(): IUseEtlMappingResult {
  const [bankAccounts, setBankAccounts] = useState<IEtlBankAccountMap[]>([]);
  const [contracts, setContracts] = useState<IEtlContractMap[]>([]);
  const [cashflowItems, setCashflowItems] = useState<IEtlCashflowItemMap[]>([]);
  const [paymentMasks, setPaymentMasks] = useState<IEtlPaymentMask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<BddsCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [ba, ct, ci, pm, proj, cats] = await Promise.all([
        etlService.getBankAccountMaps(),
        etlService.getContractMaps(),
        etlService.getCashflowItemMaps(),
        etlService.getPaymentMasks(),
        projectsService.getProjects(),
        getCategories(),
      ]);
      setBankAccounts(ba);
      setContracts(ct);
      setCashflowItems(ci);
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

  const saveBankAccount = useCallback(async (guid: string, name: string, walletType: EtlWalletType) => {
    await etlService.upsertBankAccountMap(guid, name, walletType);
    await loadData();
  }, [loadData]);

  const removeBankAccount = useCallback(async (id: string) => {
    await etlService.deleteBankAccountMap(id);
    await loadData();
  }, [loadData]);

  const saveContract = useCallback(async (guid: string, name: string, inn: string, counterparty: string, projectId: string) => {
    await etlService.upsertContractMap(guid, name, inn, counterparty, projectId);
    await loadData();
  }, [loadData]);

  const removeContract = useCallback(async (id: string) => {
    await etlService.deleteContractMap(id);
    await loadData();
  }, [loadData]);

  const saveCashflowItem = useCallback(async (guid: string, name: string, categoryId: string) => {
    await etlService.upsertCashflowItemMap(guid, name, categoryId);
    await loadData();
  }, [loadData]);

  const removeCashflowItem = useCallback(async (id: string) => {
    await etlService.deleteCashflowItemMap(id);
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
    bankAccounts,
    contracts,
    cashflowItems,
    paymentMasks,
    projects,
    categories,
    loading,
    error,
    saveBankAccount,
    removeBankAccount,
    saveContract,
    removeContract,
    saveCashflowItem,
    removeCashflowItem,
    saveMask,
    removeMask,
    reload: loadData,
  };
}
