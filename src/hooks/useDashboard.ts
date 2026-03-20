import { useState, useEffect, useMemo, useCallback } from 'react';
import * as bdrService from '../services/bdrService';
import * as bdrSubService from '../services/bdrSubService';
import * as actualExecutionService from '../services/actualExecutionService';
import * as bddsService from '../services/bddsService';
import * as bddsIncomeService from '../services/bddsIncomeService';
import * as projectsService from '../services/projectsService';
import { MONTHS, SECTION_NAMES, SECTION_ORDER } from '../utils/constants';
import { OVERHEAD_CODES } from '../utils/bdrConstants';
import { calculateNetCashFlow } from '../utils/calculations';
import type { IBdrDashboardData, IBddsDashboardData, IMonthDataPoint, IIncomeByProjectPoint, ICostItem, IWaterfallItem } from '../types/dashboard';
import type { Project } from '../types/projects';
import type { MonthValues, BdrSubType } from '../types/bdr';
import type { BddsCategory, BddsRow, SectionCode } from '../types/bdds';

interface IUseDashboardResult {
  bdrData: IBdrDashboardData | null;
  bddsData: IBddsDashboardData | null;
  loading: boolean;
  error: string | null;
}

interface IYearBdrData {
  year: number;
  planMap: Map<string, MonthValues>;
  factMap: Map<string, MonthValues>;
  smrTotals: MonthValues;
  actualTotals: { ks: MonthValues; fact: MonthValues };
  subTotals: Record<string, MonthValues>;
}

interface IYearBddsData {
  year: number;
  categories: BddsCategory[];
  planMap: Map<string, MonthValues>;
  factMap: Map<string, MonthValues>;
  incomeTotals: MonthValues;
  incomeByProject: Array<{ project_id: string; month: number; amount: number }>;
}

type EntryMap = Map<string, MonthValues>;

const COST_LABELS: Record<string, string> = {
  cost_materials: 'Материалы',
  cost_labor: 'ФОТ',
  cost_subcontract: 'Субподряд',
  cost_design: 'Проектные',
  cost_rental: 'Аренда',
  cost_overhead: 'Накладные',
};

const COST_CODES = Object.keys(COST_LABELS);
const OVERHEAD_SUB_TYPES = OVERHEAD_CODES.filter(c => c !== 'overhead_01') as BdrSubType[];

function buildEntryMap(entries: Array<{ row_code?: string; category_id?: string; month: number; amount: number }>, keyField: 'row_code' | 'category_id'): EntryMap {
  const map: EntryMap = new Map();
  for (const e of entries) {
    const key = e[keyField] as string;
    if (!key) continue;
    if (!map.has(key)) map.set(key, {});
    const months = map.get(key)!;
    months[e.month] = (months[e.month] || 0) + Number(e.amount);
  }
  return map;
}

function getVal(map: EntryMap, code: string, month: number): number {
  return map.get(code)?.[month] || 0;
}

function calcBdr(code: string, month: number, type: 'plan' | 'fact', d: IYearBdrData): number {
  const v = (c: string, m: number) => getVal(type === 'plan' ? d.planMap : d.factMap, c, m);

  switch (code) {
    case 'revenue_smr':
      return type === 'plan' ? (d.smrTotals[month] || 0) : (d.actualTotals.ks[month] || v('revenue_smr', month));
    case 'revenue':
      return calcBdr('revenue_smr', month, type, d);
    case 'cost_materials':
    case 'cost_labor':
    case 'cost_subcontract':
    case 'cost_design':
    case 'cost_rental':
      return type === 'plan' ? v(code, month) : (d.subTotals[code]?.[month] ?? v(code, month));
    case 'cost_overhead':
      return OVERHEAD_CODES.reduce((sum, c) => {
        if (type === 'fact' && d.subTotals[c]) return sum + (d.subTotals[c]?.[month] || 0);
        return sum + v(c, month);
      }, 0);
    case 'cost_total':
      return COST_CODES.reduce((sum, c) => sum + calcBdr(c, month, type, d), 0);
    case 'marginal_profit':
      return calcBdr('revenue', month, type, d) - calcBdr('cost_total', month, type, d);
    case 'operating_profit':
      return calcBdr('marginal_profit', month, type, d) - v('fixed_expenses', month);
    case 'operating_profit_pct': {
      const rev = calcBdr('revenue', month, type, d);
      return rev ? (calcBdr('operating_profit', month, type, d) / rev) * 100 : 0;
    }
    case 'profit_before_tax':
      return calcBdr('operating_profit', month, type, d) + v('other_income_expense', month);
    case 'net_profit':
      return calcBdr('profit_before_tax', month, type, d);
    default:
      return v(code, month);
  }
}

function monthLabel(month: number, year: number, multiYear: boolean): string {
  const m = MONTHS.find((x) => x.key === month);
  return multiYear ? `${m?.short} ${String(year).slice(2)}` : (m?.short || '');
}

export function useDashboard(yearFrom: number, yearTo: number, projectId: string | null = null): IUseDashboardResult {
  const [bdrYears, setBdrYears] = useState<IYearBdrData[]>([]);
  const [bddsYears, setBddsYears] = useState<IYearBddsData[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const years: number[] = [];
      for (let y = yearFrom; y <= yearTo; y++) years.push(y);
      const pid = projectId || undefined;

      const [bdrResults, bddsResults, allProjects] = await Promise.all([
        Promise.all(years.map(async (year): Promise<IYearBdrData> => {
          const [planEntries, factEntries, smr, mat, lab, sub, des, ren, ovl, ovhMap, act] = await Promise.all([
            bdrService.getEntries(year, 'plan', pid),
            bdrService.getEntries(year, 'fact', pid),
            bdrService.getSmrTotalsByMonth(year, pid),
            bdrSubService.getSubTotalsByMonth('materials', year, pid),
            bdrSubService.getSubTotalsByMonth('labor', year, pid),
            bdrSubService.getSubTotalsByMonth('subcontract', year, pid),
            bdrSubService.getSubTotalsByMonth('design', year, pid),
            bdrSubService.getSubTotalsByMonth('rental', year, pid),
            bdrSubService.getSubTotalsByMonth('overhead_labor', year, pid),
            bdrSubService.getMultiSubTotalsByMonth(OVERHEAD_SUB_TYPES, year, pid),
            actualExecutionService.getAggregatedTotals(year, pid),
          ]);
          return {
            year,
            planMap: buildEntryMap(planEntries, 'row_code'),
            factMap: buildEntryMap(factEntries, 'row_code'),
            smrTotals: smr,
            actualTotals: act,
            subTotals: {
              cost_materials: mat, cost_labor: lab, cost_subcontract: sub,
              cost_design: des, cost_rental: ren, overhead_01: ovl,
              ...ovhMap,
            },
          };
        })),
        Promise.all(years.map(async (year): Promise<IYearBddsData> => {
          const [categories, planEntries, factEntries, incomeTotals, incomeByProject] = await Promise.all([
            bddsService.getCategories(),
            bddsService.getEntries(year, 'plan', pid),
            bddsService.getEntries(year, 'fact', pid),
            bddsIncomeService.getIncomeTotalsByMonth(year, pid),
            bddsIncomeService.getIncomeTotalsByMonthByProject(year),
          ]);
          return {
            year, categories,
            planMap: buildEntryMap(planEntries, 'category_id'),
            factMap: buildEntryMap(factEntries, 'category_id'),
            incomeTotals,
            incomeByProject,
          };
        })),
        projectsService.getProjects(),
      ]);

      setBdrYears(bdrResults);
      setBddsYears(bddsResults);
      setProjects(allProjects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [yearFrom, yearTo, projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const multiYear = yearFrom !== yearTo;

  const bdrData = useMemo((): IBdrDashboardData | null => {
    if (loading || !bdrYears.length) return null;

    let revenuePlan = 0, revenueFact = 0, costFact = 0, marginalFact = 0;
    let operatingFact = 0, netProfitFact = 0;
    const costFactByCode: Record<string, number> = {};
    let fixedFact = 0, otherFact = 0;

    const scurve: IMonthDataPoint[] = [];
    const costStructure: ICostItem[] = [];
    let cumPlan = 0, cumFact = 0;

    for (const d of bdrYears) {
      for (const m of MONTHS) {
        const label = monthLabel(m.key, d.year, multiYear);
        const rp = calcBdr('revenue', m.key, 'plan', d);
        const rf = calcBdr('revenue', m.key, 'fact', d);
        revenuePlan += rp;
        revenueFact += rf;

        const ct = calcBdr('cost_total', m.key, 'fact', d);
        costFact += ct;
        marginalFact += calcBdr('marginal_profit', m.key, 'fact', d);
        operatingFact += calcBdr('operating_profit', m.key, 'fact', d);
        netProfitFact += calcBdr('net_profit', m.key, 'fact', d);
        fixedFact += getVal(d.factMap, 'fixed_expenses', m.key);
        otherFact += getVal(d.factMap, 'other_income_expense', m.key);

        for (const code of COST_CODES) {
          const val = calcBdr(code, m.key, 'fact', d);
          costFactByCode[code] = (costFactByCode[code] || 0) + val;
          costStructure.push({ month: label, category: COST_LABELS[code], value: val });
        }

        cumPlan += rp;
        cumFact += rf;
        scurve.push({ month: label, value: cumPlan, type: 'План' });
        scurve.push({ month: label, value: cumFact, type: 'Факт' });
      }
    }

    const operatingPctAvg = revenueFact ? (operatingFact / revenueFact) * 100 : 0;
    const marginPercent = revenueFact ? (marginalFact / revenueFact) * 100 : 0;

    const waterfall: IWaterfallItem[] = [
      { name: 'Выручка', value: revenueFact },
      ...COST_CODES.map((c) => ({ name: COST_LABELS[c], value: -(costFactByCode[c] || 0) })),
      { name: 'Пост. расходы', value: -fixedFact },
      { name: 'Прочие', value: otherFact },
      { name: 'Чистая прибыль', value: netProfitFact },
    ];

    const revenueByMonth: IMonthDataPoint[] = [];
    for (const d of bdrYears) {
      for (const m of MONTHS) {
        const label = monthLabel(m.key, d.year, multiYear);
        revenueByMonth.push({ month: label, value: calcBdr('revenue', m.key, 'plan', d), type: 'План' });
        revenueByMonth.push({ month: label, value: calcBdr('revenue', m.key, 'fact', d), type: 'Факт' });
      }
    }

    return {
      kpis: {
        revenueFact, revenuePlan, marginalProfit: marginalFact,
        operatingProfit: operatingFact, operatingProfitPct: operatingPctAvg,
        netProfit: netProfitFact, costTotal: costFact,
      },
      scurve, costStructure, waterfall, marginPercent, revenueByMonth,
    };
  }, [bdrYears, loading, multiYear]);

  const bddsData = useMemo((): IBddsDashboardData | null => {
    if (loading || !bddsYears.length) return null;

    let ncfOp = 0, ncfInv = 0, ncfFin = 0;
    let planIncTotal = 0, factIncTotal = 0;
    const planFactIncome: IMonthDataPoint[] = [];
    const incomeByProject: IIncomeByProjectPoint[] = [];
    const planIncomeLine: IMonthDataPoint[] = [];
    const ncfBySection: IMonthDataPoint[] = [];

    const projectNameMap = new Map<string, string>();
    for (const p of projects) {
      projectNameMap.set(p.id, p.code || p.name);
    }

    // Группируем поступления по проекту: { "year|projectId" -> Map<month, amount> }
    const incByProjectMap = new Map<string, Map<number, number>>();
    for (const d of bddsYears) {
      for (const row of d.incomeByProject) {
        const key = `${d.year}|${row.project_id}`;
        if (!incByProjectMap.has(key)) incByProjectMap.set(key, new Map());
        const m = incByProjectMap.get(key)!;
        m.set(row.month, (m.get(row.month) || 0) + row.amount);
      }
    }

    for (const d of bddsYears) {
      const cats = d.categories;

      const buildNcfForSection = (sectionCode: SectionCode, monthKey: number, useFact: boolean): number => {
        const sectionCats = cats.filter((c) => c.section_code === sectionCode).sort((a, b) => a.sort_order - b.sort_order);
        const map = useFact ? d.factMap : d.planMap;
        const rows: BddsRow[] = sectionCats.filter((c) => !c.is_calculated).map((c) => {
          let months = { [monthKey]: getVal(map, c.id, monthKey) };
          if (!useFact && sectionCode === 'operating' && c.row_type === 'income') {
            months = { [monthKey]: d.incomeTotals[monthKey] || 0 };
          }
          return { categoryId: c.id, name: c.name, rowType: c.row_type, isCalculated: false, months, total: 0, factMonths: {}, factTotal: 0, parentId: null };
        });
        const ncf = calculateNetCashFlow(sectionCode, rows);
        return ncf[monthKey] || 0;
      };

      for (const m of MONTHS) {
        const label = monthLabel(m.key, d.year, multiYear);

        // План/факт поступлений (operating income)
        const opIncomeCats = cats.filter((c) => c.section_code === 'operating' && c.row_type === 'income' && !c.is_calculated);
        let planInc = 0, factInc = 0;
        for (const cat of opIncomeCats) {
          planInc += d.incomeTotals[m.key] || 0;
          factInc += getVal(d.factMap, cat.id, m.key);
        }
        planIncTotal += planInc;
        factIncTotal += factInc;
        planFactIncome.push({ month: label, value: planInc, type: 'План' });
        planFactIncome.push({ month: label, value: factInc, type: 'Факт' });

        // План для линии комбо-графика
        planIncomeLine.push({ month: label, value: planInc, type: 'План' });

        // Поступления по проектам для стековых столбцов
        for (const [key, monthMap] of incByProjectMap) {
          const [yr, pid] = key.split('|');
          if (Number(yr) !== d.year) continue;
          const val = monthMap.get(m.key) || 0;
          if (val === 0) continue;
          incomeByProject.push({
            month: label,
            value: val,
            project: projectNameMap.get(pid) || pid.slice(0, 8),
          });
        }

        // ЧДП по секциям
        for (const sc of SECTION_ORDER) {
          const ncfVal = buildNcfForSection(sc as SectionCode, m.key, true);
          ncfBySection.push({ month: label, value: ncfVal, type: SECTION_NAMES[sc as SectionCode] });

          if (sc === 'operating') ncfOp += ncfVal;
          else if (sc === 'investing') ncfInv += ncfVal;
          else ncfFin += ncfVal;
        }
      }
    }

    return {
      planFactIncome, incomeByProject, planIncomeLine, ncfBySection,
      kpis: {
        ncfOperating: ncfOp, ncfInvesting: ncfInv, ncfFinancing: ncfFin,
        ncfTotal: ncfOp + ncfInv + ncfFin,
        planIncomeTotal: planIncTotal, factIncomeTotal: factIncTotal,
      },
    };
  }, [bddsYears, projects, loading, multiYear]);

  return { bdrData, bddsData, loading, error };
}
