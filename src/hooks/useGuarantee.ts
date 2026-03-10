import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Project } from '../types/projects';
import type { GuaranteeRow, GuaranteeMonthData, GuaranteeStatus, GuaranteeFact, GuaranteeFactFormData } from '../types/guarantee';
import * as guaranteeService from '../services/guaranteeService';
import * as projectsService from '../services/projectsService';

interface IUseGuaranteeResult {
  rows: GuaranteeRow[];
  projects: Project[];
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  yearFrom: number;
  yearTo: number;
  setYearFrom: (year: number) => void;
  setYearTo: (year: number) => void;
  statusFilter: GuaranteeStatus | 'all';
  setStatusFilter: (status: GuaranteeStatus | 'all') => void;
  loading: boolean;
  error: string | null;
  saveFact: (data: GuaranteeFactFormData) => Promise<void>;
  deleteFact: (projectId: string, monthKey: string) => Promise<void>;
  reload: () => Promise<void>;
}

function getStatus(returnPlan: number, returnFact: number, monthKey: string): GuaranteeStatus {
  if (returnPlan === 0 && returnFact === 0) return 'pending';
  if (returnFact >= returnPlan && returnPlan > 0) return 'returned';
  if (returnFact > 0 && returnFact < returnPlan) return 'partial';

  const [yearStr, monthStr] = monthKey.split('-');
  const planDate = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10), 0);
  const now = new Date();
  if (now > planDate && returnFact === 0) return 'overdue';

  return 'pending';
}

function getRowStatus(months: GuaranteeMonthData[]): GuaranteeStatus {
  const active = months.filter((m) => m.returnPlan > 0 || m.returnFact > 0);
  if (active.length === 0) return 'pending';
  if (active.every((m) => m.status === 'returned')) return 'returned';
  if (active.some((m) => m.status === 'overdue')) return 'overdue';
  if (active.some((m) => m.status === 'partial')) return 'partial';
  return 'pending';
}

function matchesYearRange(monthKey: string, yearFrom: number, yearTo: number): boolean {
  const year = parseInt(monthKey.split('-')[0], 10);
  return year >= yearFrom && year <= yearTo;
}

export function useGuarantee(): IUseGuaranteeResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const [yearFrom, setYearFromState] = useState(currentYear);
  const [yearTo, setYearToState] = useState(currentYear);
  const [statusFilter, setStatusFilter] = useState<GuaranteeStatus | 'all'>('all');
  const [planEntries, setPlanEntries] = useState<Array<{ project_id: string; work_type_code: string; month_key: string; amount: number }>>([]);
  const [facts, setFacts] = useState<GuaranteeFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setYearFrom = useCallback((y: number) => {
    setYearFromState(y);
    setYearToState((prev) => (y > prev ? y : prev));
  }, []);

  const setYearTo = useCallback((y: number) => {
    setYearToState(y);
    setYearFromState((prev) => (y < prev ? y : prev));
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [projectsData, planData, factsData] = await Promise.all([
        projectsService.getProjects(),
        guaranteeService.getRetentionAndReturnPlan(selectedProjectId ?? undefined),
        guaranteeService.getFacts(selectedProjectId ?? undefined),
      ]);
      setProjects(projectsData.filter((p) => p.is_active));
      setPlanEntries(planData);
      setFacts(factsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const rows = useMemo((): GuaranteeRow[] => {
    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const projectIds = new Set(planEntries.map((e) => e.project_id));

    const result: GuaranteeRow[] = [];

    for (const projectId of projectIds) {
      const project = projectMap.get(projectId);
      if (!project) continue;

      const projectPlan = planEntries.filter((e) => e.project_id === projectId);
      const projectFacts = facts.filter((f) => f.project_id === projectId);

      const monthKeys = new Set<string>();
      for (const e of projectPlan) {
        if (matchesYearRange(e.month_key, yearFrom, yearTo)) {
          monthKeys.add(e.month_key);
        }
      }
      for (const f of projectFacts) {
        if (matchesYearRange(f.month_key, yearFrom, yearTo)) {
          monthKeys.add(f.month_key);
        }
      }

      const months: GuaranteeMonthData[] = [];
      let retentionTotal = 0;
      let planReturnTotal = 0;
      let factReturnTotal = 0;

      const sortedKeys = Array.from(monthKeys).sort();
      for (const mk of sortedKeys) {
        const retention = projectPlan
          .filter((e) => e.work_type_code === 'guarantee_retention' && e.month_key === mk)
          .reduce((s, e) => s + Number(e.amount), 0);
        const returnPlan = projectPlan
          .filter((e) => e.work_type_code === 'guarantee_return' && e.month_key === mk)
          .reduce((s, e) => s + Number(e.amount), 0);
        const fact = projectFacts.find((f) => f.month_key === mk);
        const returnFact = fact ? Number(fact.fact_amount) : 0;
        const factDate = fact?.fact_date ?? null;

        retentionTotal += retention;
        planReturnTotal += returnPlan;
        factReturnTotal += returnFact;

        months.push({
          monthKey: mk,
          retentionPlan: retention,
          returnPlan,
          returnFact,
          factDate,
          status: getStatus(returnPlan, returnFact, mk),
        });
      }

      const row: GuaranteeRow = {
        projectId,
        projectName: project.name,
        retentionTotal,
        planReturnTotal,
        factReturnTotal,
        status: getRowStatus(months),
        months,
      };

      result.push(row);
    }

    if (statusFilter !== 'all') {
      return result.filter((r) => r.status === statusFilter);
    }

    return result;
  }, [planEntries, facts, projects, yearFrom, yearTo, statusFilter]);

  const saveFact = useCallback(async (data: GuaranteeFactFormData) => {
    await guaranteeService.upsertFact(data);
    await loadData();
  }, [loadData]);

  const handleDeleteFact = useCallback(async (projectId: string, monthKey: string) => {
    await guaranteeService.deleteFact(projectId, monthKey);
    await loadData();
  }, [loadData]);

  return {
    rows,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    yearFrom,
    yearTo,
    setYearFrom,
    setYearTo,
    statusFilter,
    setStatusFilter,
    loading,
    error,
    saveFact,
    deleteFact: handleDeleteFact,
    reload: loadData,
  };
}
