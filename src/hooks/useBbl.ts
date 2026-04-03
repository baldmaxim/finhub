import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { BblTableRow, BblEntryType, MonthValues, IBblHealthMetrics } from '../types/bbl';
import type { YearMonthSlot } from '../utils/constants';
import * as bblService from '../services/bblService';
import * as bdrService from '../services/bdrService';
import * as bddsIncomeService from '../services/bddsIncomeService';
import * as receiptService from '../services/bddsReceiptService';
import * as actualExecutionService from '../services/actualExecutionService';
import { useBdds } from './useBdds';
import { BBL_ROWS, BBL_MANUAL_CODES } from '../utils/bblConstants';
import { MONTHS, buildYearMonthSlots } from '../utils/constants';

type EntryMap = Map<string, MonthValues>;

interface ILinkedData {
  /** БДДС: остатки на конец (план) */
  bddsCloseRsPlan: MonthValues;
  bddsCloseObsPlan: MonthValues;
  bddsCloseRsFact: MonthValues;
  bddsCloseObsFact: MonthValues;
  /** БДР: выручка КС-2 с заказчиком (plan/fact) */
  revenuePlan: MonthValues;
  revenueFact: MonthValues;
  /** БДР: выполнение КС-2 внутренняя (plan/fact) */
  executionPlan: MonthValues;
  executionFact: MonthValues;
  /** БДР: расходы себестоимость (plan/fact) */
  costPlan: MonthValues;
  costFact: MonthValues;
  /** БДДС: поступления от заказчика (plan/fact) */
  incomePlan: MonthValues;
  incomeFact: MonthValues;
  /** БДДС: расходные оплаты (plan/fact) */
  expensePlan: MonthValues;
  expenseFact: MonthValues;
  /** БДР: чистая прибыль (plan/fact) */
  netProfitPlan: MonthValues;
  netProfitFact: MonthValues;
  /** БДДС: дивиденды (plan/fact) */
  dividendsPlan: MonthValues;
  dividendsFact: MonthValues;
  /** БДДС: авансы от заказчика (plan/fact) */
  advancesFromCustomerPlan: MonthValues;
  advancesFromCustomerFact: MonthValues;
  /** БДДС: оплата от заказчика за выполненные работы (plan/fact) */
  paymentForCompletedPlan: MonthValues;
  paymentForCompletedFact: MonthValues;
  /** БДДС: авансы субподрядчикам (plan/fact) */
  advancesToSubPlan: MonthValues;
  advancesToSubFact: MonthValues;
  /** БДР: субподряд КС-2 (plan/fact) */
  subcontractKs2Plan: MonthValues;
  subcontractKs2Fact: MonthValues;
  /** БДДС: оплаты субподряд (plan/fact) */
  subcontractPaymentPlan: MonthValues;
  subcontractPaymentFact: MonthValues;
}

interface IUseBblResult {
  rows: BblTableRow[];
  yearRows: Map<number, BblTableRow[]>;
  yearMonthSlots: YearMonthSlot[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  updateEntry: (rowCode: string, month: number, amount: number, type: BblEntryType) => void;
  saveAll: () => Promise<void>;
  healthMetrics: IBblHealthMetrics;
}

/** Поиск дочерней строки БДДС по имени */
const findBddsChild = (
  rows: Array<{ name: string; months: MonthValues; factMonths: MonthValues; children?: Array<{ name: string; months: MonthValues; factMonths: MonthValues }> }>,
  name: string,
): { months: MonthValues; factMonths: MonthValues } | undefined => {
  for (const row of rows) {
    if (row.name === name) return row;
    if (row.children) {
      const found = row.children.find((c) => c.name === name);
      if (found) return found;
    }
  }
  return undefined;
};

/** Кумулятивная сумма: месяц M = Σ(1..M) */
const cumulativeSum = (mv: MonthValues, upToMonth: number): number => {
  let sum = 0;
  for (let m = 1; m <= upToMonth; m++) {
    sum += mv[m] || 0;
  }
  return sum;
};

export function useBbl(yearFrom: number, yearTo: number, projectId: string | null = null): IUseBblResult {
  const [yearDataMap, setYearDataMap] = useState<Map<number, { planMap: EntryMap; factMap: EntryMap; linked: ILinkedData }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirtyRef = useRef<Set<string>>(new Set());
  const yearMonthSlots = useMemo(() => buildYearMonthSlots(yearFrom, yearTo), [yearFrom, yearTo]);

  const { yearSections: bddsYearSections } = useBdds(yearFrom, yearTo, projectId);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      dirtyRef.current.clear();

      const pid = projectId || undefined;
      const years: number[] = [];
      for (let y = yearFrom; y <= yearTo; y++) years.push(y);

      const newYearData = new Map<number, { planMap: EntryMap; factMap: EntryMap; linked: ILinkedData }>();

      for (const yr of years) {
        const [planEntries, factEntries] = await Promise.all([
          bblService.getEntries(yr, 'plan', pid),
          bblService.getEntries(yr, 'fact', pid),
        ]);

        const planMap: EntryMap = new Map();
        const factMap: EntryMap = new Map();

        for (const e of planEntries) {
          if (!planMap.has(e.row_code)) planMap.set(e.row_code, {});
          const m = planMap.get(e.row_code)!;
          m[e.month] = (m[e.month] || 0) + Number(e.amount);
        }

        for (const e of factEntries) {
          if (!factMap.has(e.row_code)) factMap.set(e.row_code, {});
          const m = factMap.get(e.row_code)!;
          m[e.month] = (m[e.month] || 0) + Number(e.amount);
        }

        // Загружаем связанные данные из БДР и БДДС
        const [bdrPlan, bdrFact, smr, actTotals, incomeTotals, receiptFacts] = await Promise.all([
          bdrService.getEntries(yr, 'plan', pid),
          bdrService.getEntries(yr, 'fact', pid),
          bdrService.getSmrTotalsByMonth(yr, pid),
          actualExecutionService.getAggregatedTotals(yr, pid),
          bddsIncomeService.getIncomeTotalsByMonth(yr, pid),
          receiptService.getReceiptFactTotals(yr, pid),
        ]);

        // BDR row values
        const bdrPlanMap: EntryMap = new Map();
        const bdrFactMap: EntryMap = new Map();
        for (const e of bdrPlan) {
          if (!bdrPlanMap.has(e.row_code)) bdrPlanMap.set(e.row_code, {});
          bdrPlanMap.get(e.row_code)![e.month] = (bdrPlanMap.get(e.row_code)![e.month] || 0) + Number(e.amount);
        }
        for (const e of bdrFact) {
          if (!bdrFactMap.has(e.row_code)) bdrFactMap.set(e.row_code, {});
          bdrFactMap.get(e.row_code)![e.month] = (bdrFactMap.get(e.row_code)![e.month] || 0) + Number(e.amount);
        }

        // Извлекаем из БДДС секций
        const bddsSections = bddsYearSections.get(yr) ?? [];
        const operatingSection = bddsSections.find((s) => s.sectionCode === 'operating');
        const financingSection = bddsSections.find((s) => s.sectionCode === 'financing');
        const opRows = operatingSection?.rows ?? [];
        const finRows = financingSection?.rows ?? [];

        // Остатки на конец
        const balClose = opRows.find((r) => r.rowType === 'balance_close');
        const rsClose = balClose?.children?.find((c) => c.name.includes('расчётных счетах'));
        const obsClose = balClose?.children?.find((c) => c.name.includes('ОБС'));

        // Расходные оплаты из БДДС (expense + overhead)
        const expenseRow = opRows.find((r) => r.rowType === 'expense');
        const overheadRow = opRows.find((r) => r.rowType === 'overhead');

        // Авансы от заказчика
        const advFromCustomer = findBddsChild(opRows, 'Авансы от Заказчика (на обычный р/с)');

        // Оплата от заказчика за выполненные работы
        const paymentForCompleted = findBddsChild(opRows, 'Оплата от Заказчика за выполненные работы (на обычный р/с)');

        // Авансы субподрядчикам
        const advToSub = findBddsChild(opRows, 'Авансы субподрядчикам');

        // Субподряд (оплаты БДДС)
        const subPayments = findBddsChild(opRows, 'Субподряд');

        // Дивиденды из БДДС (financing section)
        const dividendsRow = findBddsChild(finRows, 'Выплата дивидендов');

        // Суммируем receipt facts для incomeFact
        const totalReceiptFact: MonthValues = {};
        for (const [, months] of receiptFacts) {
          for (const [month, amount] of Object.entries(months)) {
            totalReceiptFact[Number(month)] = (totalReceiptFact[Number(month)] || 0) + amount;
          }
        }

        // Выручка план = SMR без НДС, факт = КС из actual_execution
        const revenuePlan: MonthValues = smr.withoutVat;
        const revenueFact: MonthValues = actTotals.withoutVat.ks;

        // Выполнение: plan = revenue, fact = actual execution
        const executionPlan: MonthValues = { ...revenuePlan };
        const executionFact: MonthValues = actTotals.withoutVat.fact;

        // Себестоимость (cost_total из БДР)
        const costPlan: MonthValues = {};
        const costFact: MonthValues = {};
        const costCodes = ['cost_materials', 'cost_labor', 'cost_subcontract', 'cost_design', 'cost_rental'];
        for (const m of MONTHS) {
          costPlan[m.key] = costCodes.reduce((sum, c) => sum + (bdrPlanMap.get(c)?.[m.key] || 0), 0);
          costFact[m.key] = costCodes.reduce((sum, c) => sum + (bdrFactMap.get(c)?.[m.key] || 0), 0);
        }

        // Чистая прибыль
        const netProfitPlan = bdrPlanMap.get('net_profit') || {};
        const netProfitFact = bdrFactMap.get('net_profit') || {};

        // Дивиденды: берём из БДДС (financing), fallback на БДР
        const dividendsPlan = dividendsRow?.months || bdrPlanMap.get('dividends') || {};
        const dividendsFact = dividendsRow?.factMonths || bdrFactMap.get('dividends') || {};

        // Расходные оплаты БДДС
        const expensePlanM: MonthValues = {};
        const expenseFactM: MonthValues = {};
        if (expenseRow) {
          for (const m of MONTHS) {
            expensePlanM[m.key] = (expenseRow.months[m.key] || 0) + (overheadRow?.months[m.key] || 0);
            expenseFactM[m.key] = (expenseRow.factMonths[m.key] || 0) + (overheadRow?.factMonths[m.key] || 0);
          }
        }

        // Субподряд КС-2 из БДР
        const subcontractKs2Plan = bdrPlanMap.get('cost_subcontract') || {};
        const subcontractKs2Fact = bdrFactMap.get('cost_subcontract') || {};

        const linked: ILinkedData = {
          bddsCloseRsPlan: {},
          bddsCloseObsPlan: {},
          bddsCloseRsFact: {},
          bddsCloseObsFact: {},
          revenuePlan,
          revenueFact,
          executionPlan,
          executionFact,
          costPlan,
          costFact,
          incomePlan: incomeTotals,
          incomeFact: totalReceiptFact,
          expensePlan: expensePlanM,
          expenseFact: expenseFactM,
          netProfitPlan,
          netProfitFact,
          dividendsPlan,
          dividendsFact,
          advancesFromCustomerPlan: advFromCustomer?.months || {},
          advancesFromCustomerFact: advFromCustomer?.factMonths || {},
          paymentForCompletedPlan: paymentForCompleted?.months || {},
          paymentForCompletedFact: paymentForCompleted?.factMonths || {},
          advancesToSubPlan: advToSub?.months || {},
          advancesToSubFact: advToSub?.factMonths || {},
          subcontractKs2Plan,
          subcontractKs2Fact,
          subcontractPaymentPlan: subPayments?.months || {},
          subcontractPaymentFact: subPayments?.factMonths || {},
        };

        // Заполняем БДДС остатки
        for (const m of MONTHS) {
          linked.bddsCloseRsPlan[m.key] = rsClose?.months[m.key] || 0;
          linked.bddsCloseObsPlan[m.key] = obsClose?.months[m.key] || 0;
          linked.bddsCloseRsFact[m.key] = rsClose?.factMonths[m.key] || 0;
          linked.bddsCloseObsFact[m.key] = obsClose?.factMonths[m.key] || 0;
        }

        newYearData.set(yr, { planMap, factMap, linked });
      }

      setYearDataMap(newYearData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [yearFrom, yearTo, projectId, bddsYearSections]);

  useEffect(() => {
    if (bddsYearSections.size === 0) return;
    loadData();
  }, [loadData, bddsYearSections.size]);

  const buildRowsForYear = useCallback(
    (planMap: EntryMap, factMap: EntryMap, linked: ILinkedData): BblTableRow[] => {
      const getVal = (code: string, month: number, type: 'plan' | 'fact'): number => {
        const map = type === 'plan' ? planMap : factMap;
        return map.get(code)?.[month] || 0;
      };

      const calcMonthVal = (code: string, month: number, type: 'plan' | 'fact'): number => {
        const pick = <T>(plan: T, fact: T): T => type === 'plan' ? plan : fact;

        switch (code) {
          // Денежные средства из БДДС
          case 'cash_rs':
            return pick(linked.bddsCloseRsPlan[month] || 0, linked.bddsCloseRsFact[month] || 0);
          case 'cash_obs':
            return pick(linked.bddsCloseObsPlan[month] || 0, linked.bddsCloseObsFact[month] || 0);
          case 'cash_total':
            return calcMonthVal('cash_rs', month, type) + calcMonthVal('cash_obs', month, type);

          // Дебиторка по КС-2: входящее + выручка КС-2 - поступления
          case 'receivables_ks2': {
            const opening = getVal('receivables_ks2', month, type);
            const revenue = pick(linked.revenuePlan[month] || 0, linked.revenueFact[month] || 0);
            const income = pick(linked.incomePlan[month] || 0, linked.incomeFact[month] || 0);
            return opening + revenue - income;
          }

          // Дебиторка = сумма детализации
          case 'receivables':
            return calcMonthVal('receivables_ks2', month, type)
              + getVal('receivables_retentions', month, type);

          // НЗП: входящее + выполнение - КС-2 с заказчиком
          case 'inventory_wip': {
            const exec = pick(linked.executionPlan[month] || 0, linked.executionFact[month] || 0);
            const rev = pick(linked.revenuePlan[month] || 0, linked.revenueFact[month] || 0);
            const opening = getVal('inventory_wip', month, type);
            return opening + exec - rev;
          }

          // Авансы выданные: кумулятивно (авансы субподрядчикам - субподряд КС-2)
          case 'prepaid_expenses': {
            const advPaid = pick(linked.advancesToSubPlan, linked.advancesToSubFact);
            const subKs2 = pick(linked.subcontractKs2Plan, linked.subcontractKs2Fact);
            const opening = getVal('prepaid_expenses', month, type);
            return opening + cumulativeSum(advPaid, month) - cumulativeSum(subKs2, month);
          }

          // Кредиторка по КС-2: входящее + субподряд КС-2 (БДР) - оплаты субподряд (БДДС)
          case 'payables_sub_ks2': {
            const opening = getVal('payables_sub_ks2', month, type);
            const subKs2 = pick(linked.subcontractKs2Plan[month] || 0, linked.subcontractKs2Fact[month] || 0);
            const subPay = pick(linked.subcontractPaymentPlan[month] || 0, linked.subcontractPaymentFact[month] || 0);
            return opening + subKs2 - subPay;
          }

          // Кредиторка = сумма детализации
          case 'payables':
            return calcMonthVal('payables_sub_ks2', month, type)
              + getVal('payables_retentions', month, type);

          // Авансы полученные: кумулятивно (авансы от заказчика - оплата за выполненные работы)
          case 'advances_received': {
            const advRecv = pick(linked.advancesFromCustomerPlan, linked.advancesFromCustomerFact);
            const payCompl = pick(linked.paymentForCompletedPlan, linked.paymentForCompletedFact);
            const opening = getVal('advances_received', month, type);
            return opening + cumulativeSum(advRecv, month) - cumulativeSum(payCompl, month);
          }

          // Нераспр. прибыль: накопленная чистая прибыль - дивиденды
          case 'retained_earnings': {
            const np = pick(linked.netProfitPlan, linked.netProfitFact);
            const div = pick(linked.dividendsPlan, linked.dividendsFact);
            const opening = getVal('retained_earnings', month, type);
            return opening + cumulativeSum(np, month) - cumulativeSum(div, month);
          }

          // Секционные итоги
          case 'noncurrent_total':
            return getVal('fixed_assets', month, type)
              + getVal('intangible_assets', month, type)
              + getVal('other_noncurrent', month, type);

          case 'current_total':
            return calcMonthVal('cash_total', month, type)
              + calcMonthVal('receivables', month, type)
              + calcMonthVal('inventory_wip', month, type)
              + calcMonthVal('prepaid_expenses', month, type)
              + getVal('other_current_assets', month, type);

          case 'total_assets':
            return calcMonthVal('noncurrent_total', month, type)
              + calcMonthVal('current_total', month, type);

          case 'current_liabilities_total':
            return calcMonthVal('payables', month, type)
              + calcMonthVal('advances_received', month, type)
              + getVal('short_term_loans', month, type)
              + getVal('current_lt_debt', month, type)
              + getVal('other_current_liabilities', month, type);

          case 'lt_liabilities_total':
            return getVal('long_term_loans', month, type)
              + getVal('other_lt_liabilities', month, type);

          case 'equity_total':
            return getVal('share_capital', month, type)
              + calcMonthVal('retained_earnings', month, type)
              + getVal('reserve_capital', month, type);

          case 'total_liabilities_equity':
            return calcMonthVal('current_liabilities_total', month, type)
              + calcMonthVal('lt_liabilities_total', month, type)
              + calcMonthVal('equity_total', month, type);

          case 'balance_check':
            return calcMonthVal('total_assets', month, type)
              - calcMonthVal('total_liabilities_equity', month, type);

          default:
            return getVal(code, month, type);
        }
      };

      const result: BblTableRow[] = [];

      for (const def of BBL_ROWS) {
        const row: BblTableRow = {
          key: def.code,
          name: def.name,
          rowCode: def.code,
          isSectionHeader: def.isSectionHeader,
          isSemiBold: def.isSemiBold,
          isCalculated: def.isCalculated,
          isLinked: def.isLinked,
          linkedSource: def.linkedSource,
          isChild: def.isChild,
          isSectionTotal: def.isSectionTotal,
          isBalanceCheck: def.isBalanceCheck,
        };

        let planTotal = 0;
        let factTotal = 0;

        for (const m of MONTHS) {
          const planVal = def.isCalculated || def.isLinked
            ? calcMonthVal(def.code, m.key, 'plan')
            : getVal(def.code, m.key, 'plan');
          const factVal = def.isCalculated || def.isLinked
            ? calcMonthVal(def.code, m.key, 'fact')
            : getVal(def.code, m.key, 'fact');

          row[`plan_month_${m.key}`] = planVal;
          row[`fact_month_${m.key}`] = factVal;
          planTotal += planVal;
          factTotal += factVal;
        }

        row.plan_total = planTotal;
        row.fact_total = factTotal;
        result.push(row);
      }

      return result;
    },
    []
  );

  const yearRows = useMemo((): Map<number, BblTableRow[]> => {
    const map = new Map<number, BblTableRow[]>();
    for (const [yr, data] of yearDataMap) {
      map.set(yr, buildRowsForYear(data.planMap, data.factMap, data.linked));
    }
    return map;
  }, [yearDataMap, buildRowsForYear]);

  const rows = useMemo(() => yearRows.get(yearFrom) ?? [], [yearRows, yearFrom]);

  // Health metrics из последнего месяца с данными
  const healthMetrics = useMemo((): IBblHealthMetrics => {
    const lastYearRows = yearRows.get(yearTo) ?? [];
    const getRowLastMonthFact = (code: string): number => {
      const row = lastYearRows.find((r) => r.rowCode === code);
      if (!row) return 0;
      for (let m = 12; m >= 1; m--) {
        const v = (row[`fact_month_${m}`] as number) || 0;
        if (v) return v;
      }
      return 0;
    };

    const currentAssets = getRowLastMonthFact('current_total');
    const currentLiabilities = getRowLastMonthFact('current_liabilities_total');
    const totalAssets = getRowLastMonthFact('total_assets');
    const totalLE = getRowLastMonthFact('total_liabilities_equity');
    const advancesReceived = getRowLastMonthFact('advances_received');
    const advancesIssued = getRowLastMonthFact('prepaid_expenses');
    const wip = getRowLastMonthFact('inventory_wip');

    return {
      nwc: currentAssets - currentLiabilities,
      currentRatio: currentLiabilities ? currentAssets / currentLiabilities : null,
      advanceCoverageRatio: advancesIssued ? advancesReceived / advancesIssued : null,
      wipShare: totalAssets ? (wip / totalAssets) * 100 : 0,
      totalAssets,
      totalLiabilitiesEquity: totalLE,
      balanceGap: totalAssets - totalLE,
    };
  }, [yearRows, yearTo]);

  const updateEntry = useCallback(
    (rowCode: string, month: number, amount: number, type: BblEntryType) => {
      dirtyRef.current.add(`${rowCode}_${month}_${type}`);

      setYearDataMap((prev) => {
        const next = new Map(prev);
        const data = next.get(yearFrom);
        if (!data) return prev;
        const map = type === 'plan' ? new Map(data.planMap) : new Map(data.factMap);
        const months = { ...(map.get(rowCode) || {}) };
        months[month] = amount;
        map.set(rowCode, months);
        next.set(yearFrom, {
          ...data,
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
        entry_type: BblEntryType;
        project_id?: string;
      }> = [];

      const data = yearDataMap.get(yearFrom);
      if (!data) return;

      for (const code of BBL_MANUAL_CODES) {
        for (const m of MONTHS) {
          const planAmount = data.planMap.get(code)?.[m.key] || 0;
          const factAmount = data.factMap.get(code)?.[m.key] || 0;

          const base: { row_code: string; year: number; month: number; project_id?: string } = {
            row_code: code, year: yearFrom, month: m.key,
          };
          if (projectId) base.project_id = projectId;

          if (planAmount !== 0 || dirtyRef.current.has(`${code}_${m.key}_plan`)) {
            entries.push({ ...base, amount: planAmount, entry_type: 'plan' });
          }
          if (factAmount !== 0 || dirtyRef.current.has(`${code}_${m.key}_fact`)) {
            entries.push({ ...base, amount: factAmount, entry_type: 'fact' });
          }
        }
      }

      await bblService.upsertBatch(entries);
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
    updateEntry,
    saveAll,
    healthMetrics,
  };
}
