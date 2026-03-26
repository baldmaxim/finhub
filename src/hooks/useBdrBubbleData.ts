import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import * as projectsService from '../services/projectsService';
import type { IBubbleDataPoint } from '../types/dashboard';

interface IUseBdrBubbleResult {
  data: IBubbleDataPoint[];
  loading: boolean;
  error: string | null;
}

export function useBdrBubbleData(yearFrom: number, yearTo: number): IUseBdrBubbleResult {
  const [data, setData] = useState<IBubbleDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const projects = await projectsService.getProjects();
      const activeProjects = projects.filter((p) => p.is_active);

      const monthKeys: string[] = [];
      for (let y = yearFrom; y <= yearTo; y++) {
        for (let m = 1; m <= 12; m++) {
          monthKeys.push(`${y}-${String(m).padStart(2, '0')}`);
        }
      }

      // Загрузка actual_execution_entries за период (НЗП = fact - ks, Выручка = ks)
      const { data: execData, error: execErr } = await supabase
        .from('actual_execution_entries')
        .select('project_id, month_key, ks_amount, fact_amount')
        .in('month_key', monthKeys);
      if (execErr) throw execErr;

      // Загрузка bdr_sub_entries за период (себестоимость = сумма всех sub_type кроме fixed_expenses)
      const years: number[] = [];
      for (let y = yearFrom; y <= yearTo; y++) years.push(y);

      const costQueries = years.map((y) =>
        supabase
          .from('bdr_sub_entries')
          .select('project_id, amount, amount_without_nds, sub_type, entry_date')
          .neq('sub_type', 'fixed_expenses')
          .gte('entry_date', `${y}-01-01`)
          .lte('entry_date', `${y}-12-31`)
      );
      const costResults = await Promise.all(costQueries);

      const allCostEntries: Array<{ project_id: string | null; amount: number; amount_without_nds: number | null; sub_type: string }> = [];
      for (const res of costResults) {
        if (res.error) throw res.error;
        allCostEntries.push(...(res.data || []));
      }

      // Агрегация по проектам
      const projectMap = new Map<string, { ks: number; fact: number; cost: number }>();

      for (const p of activeProjects) {
        projectMap.set(p.id, { ks: 0, fact: 0, cost: 0 });
      }

      for (const e of execData || []) {
        const entry = projectMap.get(e.project_id);
        if (!entry) continue;
        entry.ks += Number(e.ks_amount) || 0;
        entry.fact += Number(e.fact_amount) || 0;
      }

      const NDS_TYPES = ['materials', 'subcontract', 'design', 'rental'];
      for (const e of allCostEntries) {
        if (!e.project_id) continue;
        const entry = projectMap.get(e.project_id);
        if (!entry) continue;
        const useNds = NDS_TYPES.includes(e.sub_type);
        entry.cost += useNds ? (Number(e.amount_without_nds) || 0) : (Number(e.amount) || 0);
      }

      const bubbleData: IBubbleDataPoint[] = [];
      for (const p of activeProjects) {
        const entry = projectMap.get(p.id);
        if (!entry || entry.ks === 0) continue;

        const revenue = entry.ks;
        const cost = entry.cost;
        const grossProfit = revenue - cost;
        const profitability = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
        const nzp = Math.max(0, entry.fact - entry.ks);

        bubbleData.push({
          project: p.code || p.name,
          revenue,
          profitability: Math.round(profitability * 10) / 10,
          nzp,
          grossProfit,
        });
      }

      setData(bubbleData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [yearFrom, yearTo]);

  useEffect(() => { loadData(); }, [loadData]);

  return { data, loading, error };
}
