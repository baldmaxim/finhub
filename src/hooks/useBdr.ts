import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { BdrTableRow, BdrSubType, MonthValues } from '../types/bdr';
import * as bdrService from '../services/bdrService';
import * as bdrSubService from '../services/bdrSubService';
import * as actualExecutionService from '../services/actualExecutionService';
import * as fixedPlanService from '../services/bdrFixedExpensesPlanService';
import type { ActualExecutionTotals } from '../types/actualExecution';
import { BDR_ROWS, BDR_OVERHEAD_ROWS, OVERHEAD_CODES, DIRECT_COST_ROW_CODES } from '../utils/bdrConstants';
import { MONTHS, buildYearMonthSlots } from '../utils/constants';
import type { YearMonthSlot } from '../utils/constants';

interface YearData {
  planMap: EntryMap;
  factMap: EntryMap;
  subTotals: Record<string, MonthValues>;
  smrTotals: MonthValues;
  actualTotals: ActualExecutionTotals;
  fixedExpensesFactMonthly: number;
}

interface IUseBdrResult {
  rows: BdrTableRow[];
  yearRows: Map<number, BdrTableRow[]>;
  yearMonthSlots: YearMonthSlot[];
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
  const [yearDataMap, setYearDataMap] = useState<Map<number, YearData>>(new Map());
  const [smrAllYearsTotal, setSmrAllYearsTotal] = useState(0);
  const [revenueCumBefore, setRevenueCumBefore] = useState<{ plan: number; fact: number }>({ plan: 0, fact: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overheadExpanded, setOverheadExpanded] = useState(true);
  const [costExpanded, setCostExpanded] = useState(true);
  const [openSubType, setOpenSubType] = useState<BdrSubType | null>(null);

  const dirtyRef = useRef<Set<string>>(new Set());

  const yearMonthSlots = useMemo(() => buildYearMonthSlots(yearFrom, yearTo), [yearFrom, yearTo]);

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

      // Загружаем годовые планы ОФЗ
      const fixedPlans = await fixedPlanService.getFixedExpensesPlans(yearFrom, yearTo);

      const newYearData = new Map<number, YearData>();

      const overheadSubTypes = BDR_OVERHEAD_ROWS
        .filter((r) => r.subType)
        .map((r) => r.subType!);

      for (const yr of years) {
        const [planEntries, factEntries, smr, mat, lab, sub, des, ren, fixExp, overheadSubs, act] =
          await Promise.all([
            bdrService.getEntries(yr, 'plan', pid),
            bdrService.getEntries(yr, 'fact', pid),
            bdrService.getSmrTotalsByMonth(yr, pid),
            bdrSubService.getSubTotalsByMonth('materials', yr, pid),
            bdrSubService.getSubTotalsByMonth('labor', yr, pid),
            bdrSubService.getSubTotalsByMonth('subcontract', yr, pid),
            bdrSubService.getSubTotalsByMonth('design', yr, pid),
            bdrSubService.getSubTotalsByMonth('rental', yr, pid),
            bdrSubService.getFixedExpensesTotalsByMonth(yr, pid),
            bdrSubService.getMultiSubTotalsByMonth(overheadSubTypes, yr, pid),
            actualExecutionService.getAggregatedTotals(yr, pid),
          ]);

        const pMap: EntryMap = new Map();
        const fMap: EntryMap = new Map();

        for (const e of planEntries) {
          if (!pMap.has(e.row_code)) pMap.set(e.row_code, {});
          const m = pMap.get(e.row_code)!;
          m[e.month] = (m[e.month] || 0) + Number(e.amount);
        }

        for (const e of factEntries) {
          if (!fMap.has(e.row_code)) fMap.set(e.row_code, {});
          const m = fMap.get(e.row_code)!;
          m[e.month] = (m[e.month] || 0) + Number(e.amount);
        }

        const subTotals: Record<string, MonthValues> = {
          cost_materials: mat, cost_labor: lab, cost_subcontract: sub,
          cost_design: des, cost_rental: ren, fixed_expenses: fixExp,
        };

        for (const ohDef of BDR_OVERHEAD_ROWS) {
          if (ohDef.subType) {
            subTotals[ohDef.code] = overheadSubs[ohDef.subType] || {};
          }
        }

        // Расчёт ежемесячного факта ОФЗ
        const annualOfz = fixedPlans[yr] || 0;
        let fixedExpensesFactMonthly = annualOfz / 12;

        // Для проекта — доля от общего выполнения
        if (pid && annualOfz > 0) {
          const share = await fixedPlanService.getProjectExecutionShare(yr, pid);
          fixedExpensesFactMonthly = (annualOfz / 12) * share;
        }

        newYearData.set(yr, {
          planMap: pMap,
          factMap: fMap,
          subTotals: subTotals,
          smrTotals: smr.withoutVat,
          actualTotals: act.withoutVat,
          fixedExpensesFactMonthly,
        });
      }

      setYearDataMap(newYearData);
      setSmrAllYearsTotal(smrAllTotal);
      setRevenueCumBefore(cumBefore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [yearFrom, yearTo, projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const buildRowsForYear = useCallback(
    (yd: YearData, yearCumBefore: { plan: number; fact: number }): BdrTableRow[] => {
      const { planMap, factMap, subTotals: ySub, smrTotals: ySmr, actualTotals: yAct } = yd;

      const getVal = (code: string, month: number, type: 'plan' | 'fact'): number => {
        const map = type === 'plan' ? planMap : factMap;
        return map.get(code)?.[month] || 0;
      };

      const calcMonthVal = (code: string, month: number, type: 'plan' | 'fact'): number => {
        switch (code) {
          case 'revenue_smr':
            return type === 'plan' ? (ySmr[month] || 0) : (yAct.ks[month] || getVal('revenue_smr', month, 'fact'));
          case 'execution_total':
            if (type === 'plan') return calcMonthVal('revenue_smr', month, 'plan');
            return yAct.fact[month] || getVal('execution_total', month, 'fact');
          case 'revenue':
            return calcMonthVal('revenue_smr', month, type);
          case 'contract_not_accepted':
            return calcMonthVal('execution_total', month, type) - calcMonthVal('revenue_smr', month, type);
          case 'readiness_percent': {
            if (!smrAllYearsTotal) return 0;
            let cumulative = type === 'plan' ? yearCumBefore.plan : yearCumBefore.fact;
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
          case 'cost_materials':
          case 'cost_labor':
          case 'cost_subcontract':
          case 'cost_design':
          case 'cost_rental':
            if (type === 'fact' && ySub[code]) {
              return ySub[code]?.[month] || 0;
            }
            return getVal(code, month, type);
          case 'cost_overhead':
            if (type === 'plan') {
              return calcMonthVal('revenue_smr', month, 'plan') * 0.1;
            }
            return OVERHEAD_CODES.reduce((sum, c) => {
              if (ySub[c]) {
                return sum + (ySub[c]?.[month] || 0);
              }
              return sum + getVal(c, month, type);
            }, 0);
          case 'direct_cost_total':
            return DIRECT_COST_ROW_CODES.reduce((sum, c) => sum + calcMonthVal(c, month, type), 0);
          case 'cost_total':
            return calcMonthVal('direct_cost_total', month, type) + calcMonthVal('cost_overhead', month, type);
          case 'overhead_ratio': {
            const direct = calcMonthVal('direct_cost_total', month, type);
            if (!direct) return 0;
            return (calcMonthVal('cost_overhead', month, type) / direct) * 100;
          }
          case 'labor_cost_ratio': {
            const cost = calcMonthVal('cost_total', month, type);
            if (!cost) return 0;
            return (calcMonthVal('cost_labor', month, type) / cost) * 100;
          }
          case 'marginal_profit':
            return calcMonthVal('revenue', month, type)
              - calcMonthVal('direct_cost_total', month, type)
              - calcMonthVal('cost_overhead', month, type);
          case 'gross_margin': {
            const rev = calcMonthVal('revenue', month, type);
            if (!rev) return 0;
            return (calcMonthVal('marginal_profit', month, type) / rev) * 100;
          }
          case 'fixed_expenses':
            if (type === 'fact' && ySub['fixed_expenses']) {
              return ySub['fixed_expenses']?.[month] || 0;
            }
            return getVal('fixed_expenses', month, type);
          case 'operating_profit':
            return calcMonthVal('marginal_profit', month, type) - calcMonthVal('fixed_expenses', month, type);
          case 'operating_profit_pct': {
            const rev = calcMonthVal('revenue', month, type);
            if (!rev) return 0;
            return (calcMonthVal('operating_profit', month, type) / rev) * 100;
          }
          case 'profit_before_tax':
            return calcMonthVal('operating_profit', month, type) + getVal('other_income_expense', month, type);
          case 'net_profit':
            return calcMonthVal('profit_before_tax', month, type) - getVal('income_tax', month, type);
          case 'net_profit_margin': {
            const rev = calcMonthVal('revenue', month, type);
            if (!rev) return 0;
            return (calcMonthVal('net_profit', month, type) / rev) * 100;
          }
          default:
            return getVal(code, month, type);
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
          isKeyMetric: def.isKeyMetric,
        };

        if (def.isHeader) return row;

        let planTotal = 0;
        let factTotal = 0;

        for (const m of MONTHS) {
          let planVal: number;
          let factVal: number;

          if (def.isPlanCalculated && def.isClickable) {
            planVal = calcMonthVal(def.code, m.key, 'plan');
            factVal = calcMonthVal(def.code, m.key, 'fact');
          } else if (def.isCalculated || def.isPlanCalculated) {
            planVal = calcMonthVal(def.code, m.key, 'plan');
            factVal = def.isCalculated
              ? calcMonthVal(def.code, m.key, 'fact')
              : getVal(def.code, m.key, 'fact');
          } else if (def.isClickable && def.subType && ySub[def.code]) {
            planVal = getVal(def.code, m.key, 'plan');
            factVal = ySub[def.code]?.[m.key] || 0;
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

      const result: BdrTableRow[] = [];
      for (const def of BDR_ROWS) {
        if (def.isCostChild) {
          if (!costExpanded) continue;
          result.push(buildRow(def, { isCostChild: true }));
          continue;
        }
        result.push(buildRow(def));
        if (def.isOverhead && overheadExpanded) {
          for (const ohDef of BDR_OVERHEAD_ROWS) {
            result.push(buildRow(ohDef, { isOverheadItem: true }));
          }
        }
      }

      return result;
    },
    [smrAllYearsTotal, overheadExpanded, costExpanded]
  );

  const yearRows = useMemo((): Map<number, BdrTableRow[]> => {
    const map = new Map<number, BdrTableRow[]>();
    const years = Array.from(yearDataMap.keys()).sort((a, b) => a - b);
    let cumPlan = revenueCumBefore.plan;
    let cumFact = revenueCumBefore.fact;

    for (const yr of years) {
      const yd = yearDataMap.get(yr)!;
      map.set(yr, buildRowsForYear(yd, { plan: cumPlan, fact: cumFact }));

      // Накапливаем выручку текущего года для следующего
      for (let m = 1; m <= 12; m++) {
        cumPlan += yd.smrTotals[m] || 0;
        cumFact += yd.actualTotals.ks[m] || yd.factMap.get('revenue_smr')?.[m] || 0;
      }
    }
    return map;
  }, [yearDataMap, buildRowsForYear, revenueCumBefore]);

  // Обратная совместимость: rows = yearRows первого года
  const rows = useMemo((): BdrTableRow[] => {
    return yearRows.get(yearFrom) ?? [];
  }, [yearRows, yearFrom]);

  const updateEntry = useCallback(
    (rowCode: string, month: number, amount: number, type: 'plan' | 'fact') => {
      dirtyRef.current.add(`${rowCode}_${month}_${type}`);

      setYearDataMap((prev) => {
        const next = new Map(prev);
        const yd = next.get(yearFrom);
        if (!yd) return prev;
        const map = type === 'plan' ? new Map(yd.planMap) : new Map(yd.factMap);
        const months = { ...(map.get(rowCode) || {}) };
        months[month] = amount;
        map.set(rowCode, months);
        next.set(yearFrom, {
          ...yd,
          [type === 'plan' ? 'planMap' : 'factMap']: map,
        });
        return next;
      });
    },
    [yearFrom]
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

      const yd = yearDataMap.get(yearFrom);
      if (!yd) return;

      const allRowDefs = [...BDR_ROWS, ...BDR_OVERHEAD_ROWS];

      for (const def of allRowDefs) {
        if (def.isHeader || def.isCalculated) continue;

        for (const m of MONTHS) {
          const planAmount = yd.planMap.get(def.code)?.[m.key] || 0;
          const factAmount = yd.factMap.get(def.code)?.[m.key] || 0;

          const base: { row_code: string; year: number; month: number; project_id?: string } = {
            row_code: def.code, year: yearFrom, month: m.key,
          };
          if (projectId) base.project_id = projectId;

          if (!def.isPlanCalculated && (planAmount !== 0 || dirtyRef.current.has(`${def.code}_${m.key}_plan`))) {
            entries.push({ ...base, amount: planAmount, entry_type: 'plan' });
          }
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
  }, [yearDataMap, yearFrom, projectId]);

  return {
    rows,
    yearRows,
    yearMonthSlots,
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
