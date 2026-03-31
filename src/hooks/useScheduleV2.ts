import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Project } from '../types/projects';
import type {
  IScheduleV2Category,
  IScheduleV2Monthly,
  IScheduleV2Finance,
  IScheduleV2CostRow,
  IScheduleV2MonthlyRow,
} from '../types/scheduleV2';
import { FINANCE_ROW_LABELS } from '../types/scheduleV2';
import * as scheduleV2Service from '../services/scheduleV2Service';
import * as projectsService from '../services/projectsService';
import * as bddsIncomeService from '../services/bddsIncomeService';
import { getCategoryWorkType } from '../utils/scheduleV2Mapping';

type CostGroup = 'direct' | 'commercial';

/** Ставка ГУ — 5% от СМР (стандарт ДС СТРОЙ / ДОНСТРОЙ) */
const GU_RATE = 0.05;
/** НДС 22% с 2026 г. */
const VAT_RATE_2026 = 22;
const VAT_RATE_DEFAULT = 20;

interface IUseScheduleV2Result {
  projectName: string;
  costGroup: CostGroup;
  setCostGroup: (g: CostGroup) => void;
  costRows: IScheduleV2CostRow[];
  monthlyRows: IScheduleV2MonthlyRow[];
  monthKeys: string[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  fillBdds: () => Promise<void>;
  filling: boolean;
}

export function useScheduleV2(yearFrom: number, yearTo: number): IUseScheduleV2Result {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [costGroup, setCostGroup] = useState<CostGroup>('direct');
  const [categories, setCategories] = useState<IScheduleV2Category[]>([]);
  const [monthlyData, setMonthlyData] = useState<IScheduleV2Monthly[]>([]);
  const [financeData, setFinanceData] = useState<IScheduleV2Finance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const projects = await projectsService.getProjects();
        const sobytie = projects.find((p: Project) =>
          p.code === 'SOB-62' || p.name.includes('Событие 6.2')
        );
        if (sobytie) {
          setProjectId(sobytie.id);
          setProjectName(sobytie.name);
        } else {
          setError('Проект «Событие 6.2» не найден. Выполните миграцию 022.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки проектов');
      }
    })();
  }, []);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);
      const [cats, monthly, finance] = await Promise.all([
        scheduleV2Service.getCategories(projectId),
        scheduleV2Service.getMonthlyData(projectId),
        scheduleV2Service.getFinanceData(projectId),
      ]);
      setCategories(cats);
      setMonthlyData(monthly);
      setFinanceData(finance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** Общая сумма контракта по выбранной группе затрат */
  const totalContractValue = useMemo(() => {
    return categories
      .filter((c) => c.cost_group === costGroup)
      .reduce((s, c) => s + Number(c.total), 0);
  }, [categories, costGroup]);

  // === Фильтрация по годам ===
  const filteredMonthly = useMemo(() => {
    return monthlyData.filter((e) => {
      const year = parseInt(e.month_key.split('-')[0], 10);
      return year >= yearFrom && year <= yearTo;
    });
  }, [monthlyData, yearFrom, yearTo]);

  const filteredFinance = useMemo(() => {
    return financeData.filter((e) => {
      const year = parseInt(e.month_key.split('-')[0], 10);
      return year >= yearFrom && year <= yearTo;
    });
  }, [financeData, yearFrom, yearTo]);

  // === Категории текущей группы (для отображения) ===
  const groupCategories = useMemo(() => {
    return categories
      .filter((c) => c.cost_group === costGroup)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [categories, costGroup]);

  const groupCatIds = useMemo(() => {
    return new Set(groupCategories.map((c) => c.id));
  }, [groupCategories]);

  // === Месяцы ===
  const monthKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const e of filteredMonthly) {
      if (groupCatIds.has(e.category_id)) keys.add(e.month_key);
    }
    for (const e of filteredFinance) keys.add(e.month_key);
    return Array.from(keys).sort();
  }, [filteredMonthly, filteredFinance, groupCatIds]);

  // === Помесячные суммы СМР по выбранной группе затрат ===
  const groupSmrByMonth = useMemo((): Map<string, number> => {
    const map = new Map<string, number>();
    for (const e of filteredMonthly) {
      if (groupCatIds.has(e.category_id)) {
        map.set(e.month_key, (map.get(e.month_key) || 0) + Number(e.amount));
      }
    }
    return map;
  }, [filteredMonthly, groupCatIds]);

  // === Авансы из БД ===
  const advanceIncomeByMonth = useMemo((): Map<string, number> => {
    const map = new Map<string, number>();
    for (const e of filteredFinance) {
      if (e.row_code === 'advance_income') {
        map.set(e.month_key, (map.get(e.month_key) || 0) + Number(e.amount));
      }
    }
    return map;
  }, [filteredFinance]);

  // === Динамический расчёт финансовых параметров по формулам договора ===
  const financeCalc = useMemo(() => {
    const allMonths = Array.from(new Set([
      ...groupSmrByMonth.keys(),
      ...advanceIncomeByMonth.keys(),
    ])).sort();

    const result: Record<string, {
      smr: number;
      smrNoVat: number;
      advanceIncome: number;
      advanceOffset: number;
      guaranteeRetention: number;
      guaranteeReturn: number;
      totalIncome: number;
    }> = {};

    let cumulativeWorkDone = 0;
    let cumulativeAdvancesPaid = 0;
    let cumulativeAdvancesOffset = 0;
    let cumulativeGU = 0;

    for (const mk of allMonths) {
      const smr = groupSmrByMonth.get(mk) || 0;
      const advanceIncome = advanceIncomeByMonth.get(mk) || 0;
      const year = parseInt(mk.split('-')[0], 10);
      const vatRate = year >= 2026 ? VAT_RATE_2026 : VAT_RATE_DEFAULT;
      const smrNoVat = smr * 100 / (100 + vatRate);

      // --- Зачёт аванса (п.4.17.2 договора) ---
      // % зачёта = непогашенный аванс на начало периода / оставшиеся работы на начало периода
      // Зачёт = СМР_месяца × % зачёта
      const unpaidAdvances = cumulativeAdvancesPaid - cumulativeAdvancesOffset;
      const remainingWork = totalContractValue - cumulativeWorkDone;
      const offsetPercent = remainingWork > 0 ? unpaidAdvances / remainingWork : 0;
      const advanceOffset = smr * offsetPercent;

      // --- Гарантийное удержание — 5% от СМР ---
      const guaranteeRetention = smr * GU_RATE;

      // --- Итого поступление = СМР + Аванс - Зачёт - ГУ + Возврат ГУ ---
      const totalIncome = smr + advanceIncome - advanceOffset - guaranteeRetention;

      result[mk] = {
        smr,
        smrNoVat,
        advanceIncome,
        advanceOffset,
        guaranteeRetention,
        guaranteeReturn: 0,
        totalIncome,
      };

      // Обновляем накопительные итоги
      cumulativeAdvancesPaid += advanceIncome;
      cumulativeAdvancesOffset += advanceOffset;
      cumulativeWorkDone += smr;
      cumulativeGU += guaranteeRetention;
    }

    // Возврат ГУ — через 24 месяца после окончания работ (сентябрь 2028 → сентябрь 2030)
    const guReturnMonth = '2030-09';
    if (!result[guReturnMonth]) {
      result[guReturnMonth] = {
        smr: 0, smrNoVat: 0, advanceIncome: 0,
        advanceOffset: 0, guaranteeRetention: 0,
        guaranteeReturn: cumulativeGU, totalIncome: cumulativeGU,
      };
    } else {
      result[guReturnMonth].guaranteeReturn = cumulativeGU;
      result[guReturnMonth].totalIncome += cumulativeGU;
    }

    return result;
  }, [groupSmrByMonth, advanceIncomeByMonth, totalContractValue]);

  // === Таблица стоимости ===
  const costRows = useMemo((): IScheduleV2CostRow[] => {
    const result: IScheduleV2CostRow[] = [];

    for (const cat of groupCategories) {
      result.push({
        key: cat.id,
        id: cat.id,
        name: cat.name,
        costGroup: costGroup,
        volume: Number(cat.volume),
        unit: cat.unit,
        pricePerUnit: Number(cat.price_per_unit),
        costMaterials: Number(cat.cost_materials),
        costLabor: Number(cat.cost_labor),
        costSubMaterials: Number(cat.cost_sub_materials),
        costSubLabor: Number(cat.cost_sub_labor),
        total: Number(cat.total),
      });
    }

    result.push({
      key: 'grand_total',
      name: 'Итого',
      costGroup: costGroup,
      isTotal: true,
      volume: 0,
      unit: '',
      pricePerUnit: 0,
      costMaterials: groupCategories.reduce((s, c) => s + Number(c.cost_materials), 0),
      costLabor: groupCategories.reduce((s, c) => s + Number(c.cost_labor), 0),
      costSubMaterials: groupCategories.reduce((s, c) => s + Number(c.cost_sub_materials), 0),
      costSubLabor: groupCategories.reduce((s, c) => s + Number(c.cost_sub_labor), 0),
      total: groupCategories.reduce((s, c) => s + Number(c.total), 0),
    });

    return result;
  }, [groupCategories, costGroup]);

  // === Таблица помесячного распределения ===
  const monthlyRows = useMemo((): IScheduleV2MonthlyRow[] => {
    const result: IScheduleV2MonthlyRow[] = [];

    // Категории текущей группы
    for (const cat of groupCategories) {
      const row: IScheduleV2MonthlyRow = {
        key: `monthly_${cat.id}`,
        name: cat.name,
        categoryId: cat.id,
      };
      const catMonthly = filteredMonthly.filter((m) => m.category_id === cat.id);
      for (const m of catMonthly) {
        row[m.month_key] = Number(m.amount);
      }
      result.push(row);
    }

    // Все месяцы для финансовых строк (включая 2030-09 для возврата ГУ)
    const financeMonths = Object.keys(financeCalc).sort();
    const allDisplayMonths = Array.from(new Set([...monthKeys, ...financeMonths])).sort();

    // Финансовые строки (рассчитаны динамически)
    type FinanceField = 'smr' | 'smrNoVat' | 'advanceIncome' | 'advanceOffset' |
      'guaranteeRetention' | 'guaranteeReturn' | 'totalIncome';

    const financeRows: Array<{
      code: string;
      label: string;
      field: FinanceField;
      bold: boolean;
    }> = [
      { code: 'total_smr', label: FINANCE_ROW_LABELS.total_smr, field: 'smr', bold: true },
      { code: 'total_smr_no_vat', label: FINANCE_ROW_LABELS.total_smr_no_vat, field: 'smrNoVat', bold: false },
      { code: 'advance_income', label: FINANCE_ROW_LABELS.advance_income, field: 'advanceIncome', bold: false },
      { code: 'advance_offset', label: FINANCE_ROW_LABELS.advance_offset, field: 'advanceOffset', bold: false },
      { code: 'guarantee_retention', label: FINANCE_ROW_LABELS.guarantee_retention, field: 'guaranteeRetention', bold: false },
      { code: 'guarantee_return', label: FINANCE_ROW_LABELS.guarantee_return, field: 'guaranteeReturn', bold: false },
      { code: 'total_income', label: FINANCE_ROW_LABELS.total_income, field: 'totalIncome', bold: true },
    ];

    result.push({
      key: 'header_finance',
      name: 'Финансовые параметры',
      isHeader: true,
    });

    for (const fr of financeRows) {
      const row: IScheduleV2MonthlyRow = {
        key: `finance_${fr.code}`,
        name: fr.label,
        rowCode: fr.code,
        isBold: fr.bold,
      };

      for (const mk of allDisplayMonths) {
        const data = financeCalc[mk];
        if (data) {
          const val = data[fr.field];
          if (val !== 0) row[mk] = Math.round(val * 100) / 100;
        }
      }

      result.push(row);
    }

    return result;
  }, [groupCategories, filteredMonthly, monthKeys, financeCalc]);

  // Месяцы для отображения (объединение категорий + финансов)
  const displayMonthKeys = useMemo(() => {
    const financeMonths = Object.keys(financeCalc);
    return Array.from(new Set([...monthKeys, ...financeMonths])).sort();
  }, [monthKeys, financeCalc]);

  // === Заполнение БДДС/БДР из данных Плановый график 2.0 ===
  const [filling, setFilling] = useState(false);

  const fillBdds = useCallback(async (): Promise<number> => {
    if (!projectId) throw new Error('Проект не найден');
    setFilling(true);
    try {
      // Загружаем ВСЕ помесячные данные (без фильтра по годам) для полноты расчёта
      const allMonthly = await scheduleV2Service.getMonthlyData(projectId);
      const allFinance = await scheduleV2Service.getFinanceData(projectId);

      // Категории текущей группы затрат
      const groupCats = categories.filter((c) => c.cost_group === costGroup);
      const catIds = new Set(groupCats.map((c) => c.id));
      const catIdToName = new Map<string, string>();
      for (const cat of groupCats) {
        catIdToName.set(cat.id, cat.name);
      }

      // Общая сумма контракта (для расчёта зачёта аванса)
      const contractTotal = groupCats.reduce((s, c) => s + Number(c.total), 0);

      // Помесячные суммы СМР по группе
      const smrByMonth = new Map<string, number>();
      for (const e of allMonthly) {
        if (!catIds.has(e.category_id)) continue;
        smrByMonth.set(e.month_key, (smrByMonth.get(e.month_key) || 0) + Number(e.amount));
      }

      // Авансы из БД
      const advByMonth = new Map<string, number>();
      for (const e of allFinance) {
        if (e.row_code === 'advance_income') {
          advByMonth.set(e.month_key, (advByMonth.get(e.month_key) || 0) + Number(e.amount));
        }
      }

      // 1. Маппинг категорий → work_type_code, агрегация помесячных сумм
      const smrByCodeMonth = new Map<string, Map<string, number>>();
      for (const entry of allMonthly) {
        if (!catIds.has(entry.category_id)) continue;
        const catName = catIdToName.get(entry.category_id);
        if (!catName) continue;
        const workType = getCategoryWorkType(catName);
        if (!workType) continue;

        if (!smrByCodeMonth.has(workType)) smrByCodeMonth.set(workType, new Map());
        const monthMap = smrByCodeMonth.get(workType)!;
        monthMap.set(entry.month_key, (monthMap.get(entry.month_key) || 0) + Number(entry.amount));
      }

      // 2. Пересчёт финансовых параметров (полный диапазон, без фильтра по годам)
      const allMonths = Array.from(new Set([...smrByMonth.keys(), ...advByMonth.keys()])).sort();
      let cumWork = 0, cumAdvPaid = 0, cumAdvOffset = 0, cumGU = 0;

      const finCalc: Record<string, {
        smr: number; advanceIncome: number; advanceOffset: number;
        guaranteeRetention: number; guaranteeReturn: number; totalIncome: number;
      }> = {};

      for (const mk of allMonths) {
        const smr = smrByMonth.get(mk) || 0;
        const advIncome = advByMonth.get(mk) || 0;
        const unpaid = cumAdvPaid - cumAdvOffset;
        const remaining = contractTotal - cumWork;
        const offsetPct = remaining > 0 ? unpaid / remaining : 0;
        const advOffset = smr * offsetPct;
        const gu = smr * 0.05;
        const totalIncome = smr + advIncome - advOffset - gu;

        finCalc[mk] = { smr, advanceIncome: advIncome, advanceOffset: advOffset, guaranteeRetention: gu, guaranteeReturn: 0, totalIncome };
        cumAdvPaid += advIncome;
        cumAdvOffset += advOffset;
        cumWork += smr;
        cumGU += gu;
      }

      // Возврат ГУ — 24 месяца после окончания работ
      const guReturnMonth = '2030-09';
      if (!finCalc[guReturnMonth]) {
        finCalc[guReturnMonth] = { smr: 0, advanceIncome: 0, advanceOffset: 0, guaranteeRetention: 0, guaranteeReturn: cumGU, totalIncome: cumGU };
      } else {
        finCalc[guReturnMonth].guaranteeReturn = cumGU;
        finCalc[guReturnMonth].totalIncome += cumGU;
      }

      // 3. Собираем записи для upsert
      const entries: Array<{
        project_id: string;
        work_type_code: string;
        month_key: string;
        amount: number;
      }> = [];

      // СМР по видам работ
      for (const [workType, monthMap] of smrByCodeMonth) {
        for (const [mk, amount] of monthMap) {
          if (amount) entries.push({ project_id: projectId, work_type_code: workType, month_key: mk, amount: Math.round(amount * 100) / 100 });
        }
      }

      // Финансовые строки
      const financeCodeMap: Array<[string, keyof typeof finCalc[string]]> = [
        ['total_smr', 'smr'],
        ['advance_income', 'advanceIncome'],
        ['advance_offset', 'advanceOffset'],
        ['guarantee_retention', 'guaranteeRetention'],
        ['guarantee_return', 'guaranteeReturn'],
        ['total_income', 'totalIncome'],
      ];

      for (const [mk, data] of Object.entries(finCalc)) {
        for (const [code, field] of financeCodeMap) {
          const val = data[field];
          if (val) {
            entries.push({
              project_id: projectId,
              work_type_code: code,
              month_key: mk,
              amount: Math.round(val * 100) / 100,
            });
          }
        }
      }

      if (entries.length === 0) {
        throw new Error(`Нет данных для заполнения. Категорий: ${groupCats.length}, помесячных записей: ${allMonthly.length}`);
      }

      // 4. Очищаем старые данные по проекту и записываем новые
      await bddsIncomeService.deleteProjectEntries(projectId);
      await bddsIncomeService.upsertEntries(entries);
      return entries.length;
    } finally {
      setFilling(false);
    }
  }, [projectId, categories, costGroup]);

  return {
    projectName,
    costGroup,
    setCostGroup,
    costRows,
    monthlyRows,
    monthKeys: displayMonthKeys,
    loading,
    error,
    reload: loadData,
    fillBdds,
    filling,
  };
}
