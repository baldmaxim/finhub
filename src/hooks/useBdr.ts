import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { BdrTableRow, BdrSubType, MonthValues } from '../types/bdr';
import * as bdrService from '../services/bdrService';
import * as bdrSubService from '../services/bdrSubService';
import * as actualExecutionService from '../services/actualExecutionService';
import type { ActualExecutionTotals } from '../types/actualExecution';
import { BDR_ROWS, BDR_OVERHEAD_ROWS, OVERHEAD_CODES, COST_ROW_CODES } from '../utils/bdrConstants';
import { MONTHS } from '../utils/constants';

interface IUseBdrResult {
  rows: BdrTableRow[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  overheadExpanded: boolean;
  toggleOverhead: () => void;
  updateEntry: (rowCode: string, month: number, amount: number, type: 'plan' | 'fact') => void;
  saveAll: () => Promise<void>;
  openSubType: BdrSubType | null;
  setOpenSubType: (subType: BdrSubType | null) => void;
  reload: () => Promise<void>;
}

type EntryMap = Map<string, MonthValues>;

export function useBdr(year: number, projectId: string | null = null): IUseBdrResult {
  const [planMap, setPlanMap] = useState<EntryMap>(new Map());
  const [factMap, setFactMap] = useState<EntryMap>(new Map());
  const [subTotals, setSubTotals] = useState<Record<string, MonthValues>>({});
  const [smrTotals, setSmrTotals] = useState<MonthValues>({});
  const [actualTotals, setActualTotals] = useState<ActualExecutionTotals>({ ks: {}, fact: {} });
  const [smrAllYearsTotal, setSmrAllYearsTotal] = useState(0);
  const [revenueCumBefore, setRevenueCumBefore] = useState<{ plan: number; fact: number }>({ plan: 0, fact: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overheadExpanded, setOverheadExpanded] = useState(false);
  const [openSubType, setOpenSubType] = useState<BdrSubType | null>(null);

  const dirtyRef = useRef<Set<string>>(new Set());

  const toggleOverhead = useCallback(() => {
    setOverheadExpanded((prev) => !prev);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      dirtyRef.current.clear();

      const pid = projectId || undefined;
      const [planEntries, factEntries, smr, matTotals, laborTotals, subTotals, designTotals, rentalTotals, overheadLaborTotals, actTotals, smrAllTotal, cumBefore] =
        await Promise.all([
          bdrService.getEntries(year, 'plan', pid),
          bdrService.getEntries(year, 'fact', pid),
          bdrService.getSmrTotalsByMonth(year, pid),
          bdrSubService.getSubTotalsByMonth('materials', year, pid),
          bdrSubService.getSubTotalsByMonth('labor', year, pid),
          bdrSubService.getSubTotalsByMonth('subcontract', year, pid),
          bdrSubService.getSubTotalsByMonth('design', year, pid),
          bdrSubService.getSubTotalsByMonth('rental', year, pid),
          bdrSubService.getSubTotalsByMonth('overhead_labor', year, pid),
          actualExecutionService.getAggregatedTotals(year, pid),
          bdrService.getSmrAllYearsTotal(pid),
          bdrService.getRevenueCumulativeBefore(year, pid),
        ]);

      const pMap: EntryMap = new Map();
      for (const e of planEntries) {
        if (!pMap.has(e.row_code)) pMap.set(e.row_code, {});
        pMap.get(e.row_code)![e.month] = Number(e.amount);
      }

      const fMap: EntryMap = new Map();
      for (const e of factEntries) {
        if (!fMap.has(e.row_code)) fMap.set(e.row_code, {});
        fMap.get(e.row_code)![e.month] = Number(e.amount);
      }

      setPlanMap(pMap);
      setFactMap(fMap);
      setSmrTotals(smr);
      setActualTotals(actTotals);
      setSmrAllYearsTotal(smrAllTotal);
      setRevenueCumBefore(cumBefore);
      setSubTotals({
        cost_materials: matTotals,
        cost_labor: laborTotals,
        cost_subcontract: subTotals,
        cost_design: designTotals,
        cost_rental: rentalTotals,
        overhead_01: overheadLaborTotals,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [year, projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getVal = useCallback(
    (code: string, month: number, type: 'plan' | 'fact'): number => {
      const map = type === 'plan' ? planMap : factMap;
      return map.get(code)?.[month] || 0;
    },
    [planMap, factMap]
  );

  const rows = useMemo((): BdrTableRow[] => {
    const result: BdrTableRow[] = [];

    const calcMonthVal = (code: string, month: number, type: 'plan' | 'fact'): number => {
      const v = getVal;

      switch (code) {
        case 'revenue_smr':
          return type === 'plan' ? (smrTotals[month] || 0) : (actualTotals.ks[month] || v('revenue_smr', month, 'fact'));
        case 'execution_total':
          return type === 'fact' && actualTotals.fact[month]
            ? actualTotals.fact[month]
            : v('execution_total', month, type);
        case 'revenue':
          return calcMonthVal('revenue_smr', month, type);
        case 'contract_not_accepted':
          return calcMonthVal('execution_total', month, type) - calcMonthVal('revenue_smr', month, type);
        case 'readiness_percent': {
          if (!smrAllYearsTotal) return 0;
          let cumulative = type === 'plan' ? revenueCumBefore.plan : revenueCumBefore.fact;
          for (let m = 1; m <= month; m++) {
            cumulative += calcMonthVal('revenue_smr', m, type);
          }
          return (cumulative / smrAllYearsTotal) * 100;
        }
        case 'nzp_to_revenue': {
          const rev = calcMonthVal('revenue', month, type);
          if (!rev) return 0;
          const nzp = calcMonthVal('contract_not_accepted', month, type);
          return (nzp / rev) * 100;
        }
        case 'cost_overhead':
          return OVERHEAD_CODES.reduce((sum, c) => {
            if (c === 'overhead_01' && type === 'fact') {
              return sum + (subTotals['overhead_01']?.[month] || 0);
            }
            return sum + v(c, month, type);
          }, 0);
        case 'cost_total':
          return COST_ROW_CODES.reduce((sum, c) => sum + calcMonthVal(c, month, type), 0);
        case 'overhead_ratio': {
          const total = calcMonthVal('cost_total', month, type);
          const overhead = calcMonthVal('cost_overhead', month, type);
          const base = total - overhead;
          if (!base) return 0;
          return (overhead / base) * 100;
        }
        case 'marginal_profit':
          return calcMonthVal('revenue', month, type) - calcMonthVal('cost_total', month, type);
        case 'operating_profit':
          return calcMonthVal('marginal_profit', month, type) - v('fixed_expenses', month, type);
        case 'operating_profit_pct': {
          const rev = calcMonthVal('revenue', month, type);
          if (!rev) return 0;
          return (calcMonthVal('operating_profit', month, type) / rev) * 100;
        }
        case 'profit_before_tax':
          return calcMonthVal('operating_profit', month, type) + v('other_income_expense', month, type);
        case 'net_profit':
          return calcMonthVal('profit_before_tax', month, type);
        default:
          return v(code, month, type);
      }
    };

    const buildRow = (def: typeof BDR_ROWS[number], isOverheadItem?: boolean): BdrTableRow => {
      const row: BdrTableRow = {
        key: def.code,
        name: def.name,
        rowCode: def.code,
        isHeader: def.isHeader,
        isSemiBold: def.isSemiBold,
        isCalculated: def.isCalculated,
        isClickable: def.isClickable,
        isOverhead: def.isOverhead,
        isOverheadItem,
        isPercent: def.isPercent,
        subType: def.subType,
      };

      if (def.isHeader) return row;

      let planTotal = 0;
      let factTotal = 0;

      for (const m of MONTHS) {
        let planVal: number;
        let factVal: number;

        if (def.isCalculated) {
          planVal = calcMonthVal(def.code, m.key, 'plan');
          factVal = calcMonthVal(def.code, m.key, 'fact');
        } else if (def.isClickable && def.subType && subTotals[def.code]) {
          planVal = getVal(def.code, m.key, 'plan');
          factVal = subTotals[def.code]?.[m.key] || 0;
        } else {
          planVal = getVal(def.code, m.key, 'plan');
          factVal = getVal(def.code, m.key, 'fact');
        }

        row[`plan_month_${m.key}`] = planVal;
        row[`fact_month_${m.key}`] = factVal;
        planTotal += planVal;
        factTotal += factVal;
      }

      row.plan_total = planTotal;
      row.fact_total = factTotal;

      return row;
    };

    for (const def of BDR_ROWS) {
      result.push(buildRow(def));

      if (def.isOverhead && overheadExpanded) {
        for (const ohDef of BDR_OVERHEAD_ROWS) {
          result.push(buildRow(ohDef, true));
        }
      }
    }

    return result;
  }, [planMap, factMap, subTotals, smrTotals, actualTotals, smrAllYearsTotal, revenueCumBefore, overheadExpanded, getVal]);

  const updateEntry = useCallback(
    (rowCode: string, month: number, amount: number, type: 'plan' | 'fact') => {
      dirtyRef.current.add(`${rowCode}_${month}_${type}`);

      const setter = type === 'plan' ? setPlanMap : setFactMap;
      setter((prev) => {
        const next = new Map(prev);
        const months = { ...(next.get(rowCode) || {}) };
        months[month] = amount;
        next.set(rowCode, months);
        return next;
      });
    },
    []
  );

  const saveAll = useCallback(async () => {
    try {
      setSaving(true);
      const entries: Array<{
        row_code: string;
        year: number;
        month: number;
        amount: number;
        entry_type: 'plan' | 'fact';
        project_id?: string;
      }> = [];

      const allRowDefs = [...BDR_ROWS, ...BDR_OVERHEAD_ROWS];

      for (const def of allRowDefs) {
        if (def.isHeader || def.isCalculated) continue;

        for (const m of MONTHS) {
          const planAmount = planMap.get(def.code)?.[m.key] || 0;
          const factAmount = factMap.get(def.code)?.[m.key] || 0;

          const base: { row_code: string; year: number; month: number; project_id?: string } = {
            row_code: def.code, year, month: m.key,
          };
          if (projectId) base.project_id = projectId;

          if (planAmount !== 0 || dirtyRef.current.has(`${def.code}_${m.key}_plan`)) {
            entries.push({ ...base, amount: planAmount, entry_type: 'plan' });
          }
          // Для кликабельных строк факт приходит из суб-баз, не сохраняем
          if (def.isClickable) continue;
          if (factAmount !== 0 || dirtyRef.current.has(`${def.code}_${m.key}_fact`)) {
            entries.push({ ...base, amount: factAmount, entry_type: 'fact' });
          }
        }
      }

      await bdrService.upsertBatch(entries);
      dirtyRef.current.clear();
    } finally {
      setSaving(false);
    }
  }, [planMap, factMap, year, projectId]);

  return {
    rows,
    loading,
    saving,
    error,
    overheadExpanded,
    toggleOverhead,
    updateEntry,
    saveAll,
    openSubType,
    setOpenSubType,
    reload: loadData,
  };
}
