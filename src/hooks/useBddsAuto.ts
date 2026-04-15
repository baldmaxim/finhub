import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import * as bddsAutoService from '../services/bddsAutoService';
import type {
  IKsPlanEntry,
  IKsPlanFormValues,
  IBddsAutoGenResult,
  IBddsContractStatus,
  IKsPlanRowCalc,
} from '../types/bddsAuto';

const MONTHS_RU = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

/** Рассчитывает производные значения строки графика КС */
function calcRow(
  row: IKsPlanEntry,
  guRatePct: number,
  prefAdvancePct: number,
  lagMonths: number
): IKsPlanRowCalc {
  const gu = (guRatePct / 100) * row.ks_amount;
  const target = (prefAdvancePct / 100) * row.ks_amount;
  const nonTarget = row.w_remaining > 0
    ? (row.a_remaining / row.w_remaining) * row.ks_amount
    : 0;
  const net = Math.max(0, row.ks_amount - target - nonTarget - gu);

  let payMonth = row.month + lagMonths;
  let payYear = row.year;
  while (payMonth > 12) {
    payMonth -= 12;
    payYear += 1;
  }

  return { ...row, offset_target: target, offset_nontarget: nonTarget, gu_amount: gu, net_cash: net, pay_month: payMonth, pay_year: payYear };
}

export const MONTHS_RU_FULL = MONTHS_RU;

export function useBddsAuto(projectId: string | undefined, year: number) {
  const [ksPlan, setKsPlan] = useState<IKsPlanEntry[]>([]);
  const [status, setStatus] = useState<IBddsContractStatus | null>(null);
  const [genResult, setGenResult] = useState<IBddsAutoGenResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Параметры досье (передаются снаружи для вычисления предварительного расчёта)
  const [guRatePct, setGuRatePct] = useState(0);
  const [prefAdvancePct, setPrefAdvancePct] = useState(0);
  const [lagMonths, setLagMonths] = useState(2);

  const loadAll = useCallback(async () => {
    if (!projectId) {
      setKsPlan([]);
      setStatus(null);
      return;
    }
    setLoading(true);
    try {
      const [plan, stat] = await Promise.all([
        bddsAutoService.getKsPlan(projectId, year),
        bddsAutoService.getContractStatus(projectId),
      ]);
      setKsPlan(plan);
      setStatus(stat);
    } catch (err) {
      message.error('Ошибка загрузки данных БДДС Авто');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, year]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const saveKsPlanEntry = useCallback(async (values: IKsPlanFormValues) => {
    try {
      const saved = await bddsAutoService.upsertKsPlanEntry(values);
      setKsPlan((prev) => {
        const idx = prev.findIndex((r) => r.year === values.year && r.month === values.month);
        return idx >= 0 ? prev.map((r, i) => (i === idx ? saved : r)) : [...prev, saved].sort((a, b) => a.month - b.month);
      });
    } catch (err) {
      message.error('Ошибка сохранения строки КС');
      console.error(err);
    }
  }, []);

  const removeKsPlanEntry = useCallback(async (id: string) => {
    try {
      await bddsAutoService.deleteKsPlanEntry(id);
      setKsPlan((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      message.error('Ошибка удаления строки КС');
      console.error(err);
    }
  }, []);

  const generatePlan = useCallback(async () => {
    if (!projectId) return;
    setGenerating(true);
    setGenResult(null);
    try {
      const result = await bddsAutoService.generatePlanFromDossier(projectId, year);
      if (result.error) {
        message.error(result.error);
      } else {
        setGenResult(result);
        message.success(`Сгенерировано ${result.inserted} плановых записей БДДС`);
        // Перезагружаем статус после генерации
        const stat = await bddsAutoService.getContractStatus(projectId);
        setStatus(stat);
      }
    } catch (err) {
      message.error('Ошибка генерации плана');
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }, [projectId, year]);

  const calcRows: IKsPlanRowCalc[] = ksPlan.map((r) =>
    calcRow(r, guRatePct, prefAdvancePct, lagMonths)
  );

  return {
    ksPlan,
    calcRows,
    status,
    genResult,
    loading,
    generating,
    guRatePct,
    prefAdvancePct,
    lagMonths,
    setGuRatePct,
    setPrefAdvancePct,
    setLagMonths,
    saveKsPlanEntry,
    removeKsPlanEntry,
    generatePlan,
    reload: loadAll,
  };
}
