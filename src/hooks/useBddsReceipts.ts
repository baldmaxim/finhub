import { useState, useEffect, useCallback } from 'react';
import type { BddsReceiptDetail, BddsReceiptImportRow } from '../types/bddsReceipt';
import type { Project } from '../types/projects';
import * as receiptService from '../services/bddsReceiptService';
import * as bddsService from '../services/bddsService';
import { getProjects } from '../services/projectsService';

interface IUseBddsReceiptsResult {
  rows: BddsReceiptDetail[];
  projects: Project[];
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  categoryId: string | null;
  categoryName: string;
  loading: boolean;
  error: string | null;
  importReceipts: (projectId: string, year: number, data: BddsReceiptImportRow[]) => Promise<void>;
  deleteReceipt: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

const RECEIPT_CATEGORY_NAME = 'Поступление от продажи продукции и товаров, выполнения работ, оказания услуг';

export function useBddsReceipts(year: number, initialCategoryId: string | null): IUseBddsReceiptsResult {
  const [rows, setRows] = useState<BddsReceiptDetail[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(initialCategoryId);
  const [categoryName, setCategoryName] = useState(RECEIPT_CATEGORY_NAME);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Загрузка категории если не передан ID
  useEffect(() => {
    if (initialCategoryId) {
      setCategoryId(initialCategoryId);
      return;
    }
    bddsService.getCategories().then((cats) => {
      const cat = cats.find((c) => c.name === RECEIPT_CATEGORY_NAME);
      if (cat) {
        setCategoryId(cat.id);
        setCategoryName(cat.name);
      }
    });
  }, [initialCategoryId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const allProjects = await getProjects();
      const activeProjects = allProjects.filter((p) => p.is_active);
      setProjects(activeProjects);

      if (!categoryId || !selectedProjectId) {
        setRows([]);
        return;
      }

      const data = await receiptService.getReceiptDetails(selectedProjectId, categoryId, year);
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [year, categoryId, selectedProjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const importReceipts = useCallback(
    async (projectId: string, yr: number, data: BddsReceiptImportRow[]) => {
      if (!categoryId) throw new Error('Категория не найдена');
      await receiptService.importReceipts(projectId, categoryId, yr, data);
      await loadData();
    },
    [categoryId, loadData]
  );

  const deleteReceiptRow = useCallback(
    async (id: string) => {
      await receiptService.deleteReceipt(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    },
    []
  );

  return {
    rows,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    categoryId,
    categoryName,
    loading,
    error,
    importReceipts,
    deleteReceipt: deleteReceiptRow,
    reload: loadData,
  };
}
