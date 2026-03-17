import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import type { IExecutionVsKsPoint } from '../types/dashboard';

interface IUseBdrExecutionVsKsResult {
  data: IExecutionVsKsPoint[];
  loading: boolean;
  error: string | null;
}

export function useBdrExecutionVsKs(yearFrom: number, yearTo: number, projectId: string | null): IUseBdrExecutionVsKsResult {
  const [data, setData] = useState<IExecutionVsKsPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const monthKeys: string[] = [];
      for (let y = yearFrom; y <= yearTo; y++) {
        for (let m = 1; m <= 12; m++) {
          monthKeys.push(`${y}-${String(m).padStart(2, '0')}`);
        }
      }

      let query = supabase
        .from('actual_execution_entries')
        .select('month_key, ks_amount, fact_amount')
        .in('month_key', monthKeys);
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      const { data: execData, error: execErr } = await query;
      if (execErr) throw execErr;

      // Агрегация по месяцам
      const monthMap = new Map<string, { fact: number; ks: number }>();
      for (const key of monthKeys) {
        monthMap.set(key, { fact: 0, ks: 0 });
      }

      for (const e of execData || []) {
        const entry = monthMap.get(e.month_key);
        if (!entry) continue;
        entry.fact += Number(e.fact_amount) || 0;
        entry.ks += Number(e.ks_amount) || 0;
      }

      // Кумулятивные данные
      const points: IExecutionVsKsPoint[] = [];
      let cumFact = 0;
      let cumKs = 0;

      const MONTH_NAMES = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

      for (const key of monthKeys) {
        const entry = monthMap.get(key)!;
        cumFact += entry.fact;
        cumKs += entry.ks;

        const [yearStr, monthStr] = key.split('-');
        const monthIdx = parseInt(monthStr, 10) - 1;
        const label = `${MONTH_NAMES[monthIdx]} ${yearStr.slice(2)}`;

          points.push({ month: label, value: cumFact, type: 'Выполнение' });
        points.push({ month: label, value: cumKs, type: 'Актирование (КС-2)' });
      }

      // Обнулить хвосты (null для месяцев до первого и после последнего ненулевого)
      const series = new Map<string, IExecutionVsKsPoint[]>();
      for (const p of points) {
        if (!series.has(p.type)) series.set(p.type, []);
        series.get(p.type)!.push(p);
      }
      const processed: IExecutionVsKsPoint[] = [];
      for (const items of series.values()) {
        const firstIdx = items.findIndex((p) => p.value !== 0);
        const lastIdx = items.findLastIndex((p) => p.value !== 0);
        for (let i = 0; i < items.length; i++) {
          const p = items[i];
          if (firstIdx === -1 || i < firstIdx || i > lastIdx) {
            processed.push({ ...p, value: null });
          } else {
            processed.push(p);
          }
        }
      }

      setData(processed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [yearFrom, yearTo, projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  return { data, loading, error };
}
