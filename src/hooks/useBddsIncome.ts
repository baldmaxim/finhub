import { useState, useEffect, useCallback, useMemo } from 'react';
import type { IncomeTableRow } from '../types/bddsIncome';
import type { Project } from '../types/projects';
import * as bddsIncomeService from '../services/bddsIncomeService';
import * as projectsService from '../services/projectsService';
import { WORK_TYPES, SMR_CODES } from '../utils/workTypes';

interface IUseBddsIncomeResult {
  rows: IncomeTableRow[];
  monthKeys: string[];
  projects: Project[];
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  loading: boolean;
  error: string | null;
  importData: (
    projectId: string,
    data: Array<{ workTypeCode: string; note: string; months: Record<string, number> }>
  ) => Promise<void>;
  reload: () => Promise<void>;
}

export function useBddsIncome(yearFrom: number, yearTo: number): IUseBddsIncomeResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Array<{ project_id: string; work_type_code: string; month_key: string; amount: number }>>([]);
  const [notes, setNotes] = useState<Array<{ project_id: string; work_type_code: string; note: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [projectsData, entriesData, notesData] = await Promise.all([
        projectsService.getProjects(),
        bddsIncomeService.getEntries(selectedProjectId ?? undefined),
        bddsIncomeService.getNotes(selectedProjectId ?? undefined),
      ]);

      setProjects(projectsData.filter((p) => p.is_active));
      setEntries(entriesData);
      setNotes(notesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const year = parseInt(e.month_key.split('-')[0], 10);
      return year >= yearFrom && year <= yearTo;
    });
  }, [entries, yearFrom, yearTo]);

  const monthKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const e of filteredEntries) {
      keys.add(e.month_key);
    }
    return Array.from(keys).sort();
  }, [filteredEntries]);

  const rows = useMemo((): IncomeTableRow[] => {
    const result: IncomeTableRow[] = [];

    for (const wt of WORK_TYPES) {
      if (wt.isHeader) {
        result.push({
          key: wt.code,
          workTypeCode: wt.code,
          name: wt.name,
          note: '',
          isHeader: true,
        });
        continue;
      }

      const row: IncomeTableRow = {
        key: wt.code,
        workTypeCode: wt.code,
        name: wt.name,
        note: '',
        isCalculated: wt.isBold,
      };

      const noteEntry = notes.find((n) => n.work_type_code === wt.code);
      row.note = noteEntry?.note ?? '';

      if (wt.isCalculated && wt.code === 'total_smr_no_vat') {
        for (const mk of monthKeys) {
          const totalSmr = SMR_CODES.reduce((sum, code) => {
            const entry = filteredEntries.find(
              (e) => e.work_type_code === code && e.month_key === mk
            );
            return sum + (entry ? Number(entry.amount) : 0);
          }, 0);
          const year = parseInt(mk.split('-')[0], 10);
          const vatRate = year >= 2026 ? 22 : 20;
          row[mk] = totalSmr * 100 / (100 + vatRate);
        }
      } else {
        const wtEntries = filteredEntries.filter((e) => e.work_type_code === wt.code);
        for (const e of wtEntries) {
          row[e.month_key] = Number(e.amount);
        }
      }

      result.push(row);
    }

    return result;
  }, [filteredEntries, notes, monthKeys]);



  const importData = useCallback(
    async (
      projectId: string,
      data: Array<{ workTypeCode: string; note: string; months: Record<string, number> }>
    ) => {
      const entriesToUpsert: Array<{
        project_id: string;
        work_type_code: string;
        month_key: string;
        amount: number;
      }> = [];

      const notesToUpsert: Array<{
        project_id: string;
        work_type_code: string;
        note: string;
      }> = [];

      for (const item of data) {
        if (item.note) {
          notesToUpsert.push({
            project_id: projectId,
            work_type_code: item.workTypeCode,
            note: item.note,
          });
        }

        for (const [monthKey, amount] of Object.entries(item.months)) {
          entriesToUpsert.push({
            project_id: projectId,
            work_type_code: item.workTypeCode,
            month_key: monthKey,
            amount,
          });
        }
      }

      // Дедупликация по (work_type_code, month_key) — первое вхождение побеждает
      const entryMap = new Map<string, typeof entriesToUpsert[0]>();
      for (const entry of entriesToUpsert) {
        const key = `${entry.work_type_code}|${entry.month_key}`;
        if (!entryMap.has(key)) {
          entryMap.set(key, entry);
        }
      }
      const uniqueEntries = Array.from(entryMap.values());

      // Собрать уникальные месяцы из импорта
      const monthKeysSet = new Set<string>();
      for (const entry of uniqueEntries) {
        monthKeysSet.add(entry.month_key);
      }

      // Удалить старые данные только за импортируемые периоды
      await bddsIncomeService.deleteEntriesByMonths(projectId, Array.from(monthKeysSet));

      await Promise.all([
        bddsIncomeService.upsertEntries(uniqueEntries),
        bddsIncomeService.upsertNotes(notesToUpsert),
      ]);

      await loadData();
    },
    [loadData]
  );

  return {
    rows,
    monthKeys,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    loading,
    error,
    importData,
    reload: loadData,
  };
}
