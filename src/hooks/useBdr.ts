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
  costExpanded: boolean;
  toggleOverhead: () => void;
  toggleCost: () => void;
  updateEntry: (rowCode: string, month: number, amount: number, type: 'plan' | 'fact') => void;
  saveAll: () => Promise<void>;
  openSubType: BdrSubType | null;
  setOpenSubType: (subType: BdrSubType | null) => void;
  reload: () => Promise<void>;
}

type EntryMap = Map<string, MonthValues>;

export function useBdr(yearFrom: number, yearTo: number, projectId: string | null = null): IUseBdrResult {
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
  const [costExpanded, setCostExpanded] = useState(false);
  const [openSubType, setOpenSubType] = useState<BdrSubType | null>(null);

  const dirtyRef = useRef<Set<string>>(new Set());

  const toggleOverhead = useCallback(() => {
    setOverheadExpanded((prev) => !prev);
  }, []);

  const toggleCost = useCallback(() => {
    setCostExpanded((prev) => !prev);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      dirtyRef.current.clear();

      const pid = projectId || undefined;
      const years: number[] = [];
      for (let y = yearFrom; y <= yearTo; y++) years.push(y);

      const smrAllTotal = await bdrService.getSmrAllYearsTotal(pid);
      const cumBefore = await bdrService.getRevenueCumulativeBefore(yearFrom, pid);

      const pMap: EntryMap = new Map();
      const fMap: EntryMap = new Map();
      const mergedSmr: MonthValues = {};
      const mergedActual: ActualExecutionTotals = { ks: {}, fact: {} };
      const mergedSub: Record<string, MonthValues> = {
        cost_materials: {}, cost_labor: {}, cost_subcontract: {},
        cost_design: {}, cost_rental: {}, overhead_01: {},
      };

      const addToMap = (map: EntryMap, key: string, month: number, amount: number) => {
        if (!map.has(key)) map.set(key, {});
        const m = map.get(key)!;
        m[month] = (m[month] || 0) + amount;
      };

      const addToMonthValues = (target: MonthValues, source: MonthValues) => {
        for (const m of MONTHS) {
          target[m.key] = (target[m.key] || 0) + (source[m.key] || 0);
        }
      };

      for (const yr of years) {
        const [planEntries, factEntries, smr, mat, lab, sub, des, ren, ovl, act] =
          await Promise.all([
            bdrService.getEntries(yr, 'plan', pid),
            bdrService.getEntries(yr, 'fact', pid),
            bdrService.getSmrTotalsByMonth(yr, pid),
            bdrSubService.getSubTotalsByMonth('materials', yr, pid),
            bdrSubService.getSubTotalsByMonth('labor', yr, pid),
            bdrSubService.getSubTotalsByMonth('subcontract', yr, pid),
            bdrSubService.getSubTotalsByMonth('design', yr, pid),
            bdrSubService.getSubTotalsByMonth('rental', yr, pid),
            bdrSubService.getSubTotalsByMonth('overhead_labor', yr, pid),
            actualExecutionService.getAggregatedTotals(yr, pid),
          ]);

        for (const e of planEntries) addToMap(pMap, e.row_code, e.month, Number(e.amount));
        for (const e of factEntries) addToMap(fMap, e.row_code, e.month, Number(e.amount));

        addToMonthValues(mergedSmr, smr);
        addToMonthValues(mergedActual.ks, act.ks);
        addToMonthValues(mergedActual.fact, act.fact);
        addToMonthValues(mergedSub.cost_materials, mat);
        addToMonthValues(mergedSub.cost_labor, lab);
        addToMonthValues(mergedSub.cost_subcontract, sub);
        addToMonthValues(mergedSub.cost_design, des);
        addToMonthValues(mergedSub.cost_rental, ren);
        addToMonthValues(mergedSub.overhead_01, ovl);
      }

      setPlanMap(pMap);
      setFactMap(fMap);
      setSmrTotals(mergedSmr);
      setActualTotals(mergedActual);
      setSmrAllYearsTotal(smrAllTotal);
      setRevenueCumBefore(cumBefore);
      setSubTotals(mergedSub);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [yearFrom, yearTo, projectId]);

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
        case 'fixed_expenses':
          return type === 'plan'
            ? calcMonthVal('revenue_smr', month, 'plan') * 0.2
            : v('fixed_expenses', month, 'fact');
        case 'operating_profit':
          return calcMonthVal('marginal_profit', month, type) - calcMonthVal('fixed_expenses', month, type);
        case 'operating_profit_pct': {
          const rev = calcMonthVal('revenue', month, type);
          if (!rev) return 0;
          return (calcMonthVal('operating_profit', month, type) / rev) * 100;
        }
        case 'profit_before_tax':
          return calcMonthVal('operating_profit', month, type) + v('other_income_expense', month, type);
        case 'net_profit':
          return calcMonthVal('profit_before_tax', month, type) - v('income_tax', month, type);
        default:
          return v(code, month, type);
      }
    };

    const buildRow = (def: typeof BDR_ROWS[number], opts?: { isOverheadItem?: boolean; isCostChild?: boolean }): BdrTableRow => {
      const row: BdrTableRow = {
        key: def.code,
        name: def.name,
        rowCode: def.code,
        isHeader: def.isHeader,
        isSemiBold: def.isSemiBold,
        isCalculated: def.isCalculated,
        isClickable: def.isClickable,
        isOverhead: def.isOverhead,
        isOverheadItem: opts?.isOverheadItem,
        isCostParent: def.isCostParent,
        isCostChild: opts?.isCostChild,
        isPlanCalculated: def.isPlanCalculated,
        noPlan: def.noPlan,
        isPercent: def.isPercent,
        subType: def.subType,
      };

      if (def.isHeader) return row;

      let planTotal = 0;
      let factTotal = 0;

      for (const m of MONTHS) {
        let planVal: number;
        let factVal: number;

        if (def.isCalculated || def.isPlanCalculated) {
          planVal = calcMonthVal(def.code, m.key, 'plan');
          factVal = def.isCalculated
            ? calcMonthVal(def.code, m.key, 'fact')
            : getVal(def.code, m.key, 'fact');
        } else if (def.isClickable && def.subType && subTotals[def.code]) {
          planVal = getVal(def.code, m.key, 'plan');
          factVal = subTotals[def.code]?.[m.key] || 0;
        } else {
          planVal = getVal(def.code, m.key, 'plan');
          factVal = getVal(def.code, m.key, 'fact');
        }

        row[`plan_month_${m.key}`] = planVal;
        row[`fact_month_${m.key}`] = factVal;
        if (!def.isPercent) {
          planTotal += planVal;
          factTotal += factVal;
        }
      }

      row.plan_total = def.isPercent ? 0 : planTotal;
      row.fact_total = def.isPercent ? 0 : factTotal;

      return row;
    };

    for (const def of BDR_ROWS) {
      if (def.isCostChild) {
        if (!costExpanded) continue;
        result.push(buildRow(def, { isCostChild: true }));

        if (def.isOverhead && overheadExpanded) {
          for (const ohDef of BDR_OVERHEAD_ROWS) {
            result.push(buildRow(ohDef, { isOverheadItem: true, isCostChild: true }));
          }
        }
        continue;
      }

      result.push(buildRow(def));
    }

    return result;
  }, [planMap, factMap, subTotals, smrTotals, actualTotals, smrAllYearsTotal, revenueCumBefore, overheadExpanded, costExpanded, getVal]);

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
            row_code: def.code, year: yearFrom, month: m.key,
          };
          if (projectId) base.project_id = projectId;

          if (!def.isPlanCalculated && (planAmount !== 0 || dirtyRef.current.has(`${def.code}_${m.key}_plan`))) {
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
  }, [planMap, factMap, yearFrom, projectId]);

  return {
    rows,
    loading,
    saving,
    error,
    overheadExpanded,
    costExpanded,
    toggleOverhead,
    toggleCost,
    updateEntry,
    saveAll,
    openSubType,
    setOpenSubType,
    reload: loadData,
  };
}
