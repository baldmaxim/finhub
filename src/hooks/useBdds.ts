import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { BddsCategory, BddsSection, BddsRow, MonthValues } from '../types/bdds';
import * as bddsService from '../services/bddsService';
import * as bddsIncomeService from '../services/bddsIncomeService';
import * as bdrSubService from '../services/bdrSubService';
import * as receiptService from '../services/bddsReceiptService';
import { SECTION_ORDER, SECTION_NAMES, MONTHS, buildYearMonthSlots } from '../utils/constants';
import { BDR_SUB_TO_BDDS_NAME } from '../utils/bdrConstants';
import type { BdrSubType } from '../types/bdr';
import type { YearMonthSlot } from '../utils/constants';
import { calculateNetCashFlow, calculateRowTotal } from '../utils/calculations';

interface IUseBddsResult {
  sections: BddsSection[];
  yearSections: Map<number, BddsSection[]>;
  yearMonthSlots: YearMonthSlot[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  expandedParents: Set<string>;
  toggleParent: (categoryId: string) => void;
  updateFactEntry: (categoryId: string, month: number, amount: number) => void;
  saveAll: () => Promise<void>;
}

export function useBdds(yearFrom: number, yearTo: number, projectId: string | null = null): IUseBddsResult {
  const [yearSections, setYearSections] = useState<Map<number, BddsSection[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const categoriesRef = useRef<BddsCategory[]>([]);
  const dirtyFactRef = useRef<Set<string>>(new Set());

  const yearMonthSlots = useMemo(() => buildYearMonthSlots(yearFrom, yearTo), [yearFrom, yearTo]);

  // Для обратной совместимости: sections = yearSections первого (единственного) года
  const sections = useMemo(() => {
    return yearSections.get(yearFrom) ?? [];
  }, [yearSections, yearFrom]);

  const toggleParent = useCallback((categoryId: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  const buildSections = useCallback(
    (
      categories: BddsCategory[],
      planMap: Map<string, MonthValues>,
      factMap: Map<string, MonthValues>,
      incomeTotals: MonthValues
    ): BddsSection[] => {
      return SECTION_ORDER.map((sectionCode) => {
        const sectionCategories = categories
          .filter((c) => c.section_code === sectionCode)
          .sort((a, b) => a.sort_order - b.sort_order);

        const parentCats = sectionCategories.filter((c) => !c.parent_id);
        const childCats = sectionCategories.filter((c) => c.parent_id);

        const rows: BddsRow[] = parentCats.map((cat) => {
          let planMonths = planMap.get(cat.id) || {};
          const factMonths = factMap.get(cat.id) || {};

          if (sectionCode === 'operating' && cat.row_type === 'income' && !cat.is_calculated) {
            planMonths = { ...incomeTotals };
          }

          const catChildren = childCats.filter((c) => c.parent_id === cat.id);
          let children: BddsRow[] | undefined;

          if (catChildren.length > 0) {
            children = catChildren.map((child, idx) => {
              let childPlan = planMap.get(child.id) || {};
              // Автозаполнение плана первой дочерней строки доходов из bdds_income_entries
              if (sectionCode === 'operating' && cat.row_type === 'income' && idx === 0) {
                childPlan = { ...incomeTotals };
              }
              return {
                categoryId: child.id,
                name: child.name,
                rowType: child.row_type,
                isCalculated: child.is_calculated,
                months: childPlan,
                total: calculateRowTotal(childPlan),
                factMonths: factMap.get(child.id) || {},
                factTotal: calculateRowTotal(factMap.get(child.id) || {}),
                parentId: child.parent_id,
              };
            });

            if (cat.calculation_formula === 'sum_children') {
              const sumPlan: MonthValues = {};
              const sumFact: MonthValues = {};
              for (const m of MONTHS) {
                sumPlan[m.key] = children.reduce((s, ch) => s + (ch.months[m.key] || 0), 0);
                sumFact[m.key] = children.reduce((s, ch) => s + (ch.factMonths[m.key] || 0), 0);
              }
              return {
                categoryId: cat.id,
                name: cat.name,
                rowType: cat.row_type,
                isCalculated: true,
                months: sumPlan,
                total: calculateRowTotal(sumPlan),
                factMonths: sumFact,
                factTotal: calculateRowTotal(sumFact),
                parentId: null,
                children,
              };
            }
          }

          return {
            categoryId: cat.id,
            name: cat.name,
            rowType: cat.row_type,
            isCalculated: cat.is_calculated,
            months: planMonths,
            total: calculateRowTotal(planMonths),
            factMonths,
            factTotal: calculateRowTotal(factMonths),
            parentId: null,
            children,
          };
        });

        const ncfRow = rows.find((r) => r.isCalculated && !r.children);
        if (ncfRow) {
          const dataRows = rows.filter((r) => !r.isCalculated || r.children);
          ncfRow.months = calculateNetCashFlow(sectionCode, dataRows);
          ncfRow.total = calculateRowTotal(ncfRow.months);

          const factDataRows: BddsRow[] = dataRows.map((r) => ({
            ...r,
            months: r.factMonths,
          }));
          ncfRow.factMonths = calculateNetCashFlow(sectionCode, factDataRows);
          ncfRow.factTotal = calculateRowTotal(ncfRow.factMonths);
        }

        return {
          sectionCode,
          sectionName: SECTION_NAMES[sectionCode],
          rows,
        };
      });
    },
    []
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      dirtyFactRef.current.clear();

      const pid = projectId || undefined;
      const years: number[] = [];
      for (let y = yearFrom; y <= yearTo; y++) years.push(y);

      const categories = await bddsService.getCategories();
      categoriesRef.current = categories;

      const newYearSections = new Map<number, BddsSection[]>();

      // Маппинг имя БДДС-категории → category_id
      const nameToId = new Map<string, string>();
      for (const cat of categories) {
        nameToId.set(cat.name, cat.id);
      }

      for (const yr of years) {
        const [planEntries, factEntries, yearIncomeTotals, bddsTotals, receiptFacts] = await Promise.all([
          bddsService.getEntries(yr, 'plan', pid),
          bddsService.getEntries(yr, 'fact', pid),
          bddsIncomeService.getIncomeTotalsByMonth(yr, pid),
          bdrSubService.getSubTotalsForBdds(yr, pid),
          receiptService.getReceiptFactTotals(yr, pid),
        ]);

        const planMap = new Map<string, MonthValues>();
        const factMap = new Map<string, MonthValues>();

        for (const entry of planEntries) {
          if (!planMap.has(entry.category_id)) planMap.set(entry.category_id, {});
          const m = planMap.get(entry.category_id)!;
          m[entry.month] = (m[entry.month] || 0) + Number(entry.amount);
        }

        for (const entry of factEntries) {
          if (!factMap.has(entry.category_id)) factMap.set(entry.category_id, {});
          const m = factMap.get(entry.category_id)!;
          m[entry.month] = (m[entry.month] || 0) + Number(entry.amount);
        }

        // Автозаполнение факта из bdds_receipt_details
        for (const [catId, months] of receiptFacts) {
          if (!factMap.has(catId)) factMap.set(catId, {});
          const m = factMap.get(catId)!;
          for (const [month, amount] of Object.entries(months)) {
            m[Number(month)] = (m[Number(month)] || 0) + amount;
          }
        }

        // Автозаполнение БДДС плана из bdr_sub_entries (Сумма, сдвиг +1 месяц)
        for (const [subType, months] of Object.entries(bddsTotals)) {
          const bddsName = BDR_SUB_TO_BDDS_NAME[subType as BdrSubType];
          if (!bddsName) continue;
          const catId = nameToId.get(bddsName);
          if (!catId) continue;

          if (!planMap.has(catId)) planMap.set(catId, {});
          const m = planMap.get(catId)!;
          for (const [month, amount] of Object.entries(months)) {
            m[Number(month)] = (m[Number(month)] || 0) + amount;
          }
        }

        newYearSections.set(yr, buildSections(categories, planMap, factMap, yearIncomeTotals));
      }

      setYearSections(newYearSections);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [yearFrom, yearTo, projectId, buildSections]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateFactEntry = useCallback(
    (categoryId: string, month: number, amount: number) => {
      dirtyFactRef.current.add(`${categoryId}_${month}`);

      setYearSections((prev) => {
        const next = new Map(prev);
        // Редактирование только в single-year режиме
        const secs = next.get(yearFrom);
        if (!secs) return prev;

        const updated = secs.map((section) => {
          const hasCategory = section.rows.some(
            (r) => r.categoryId === categoryId || r.children?.some((ch) => ch.categoryId === categoryId)
          );
          if (!hasCategory) return section;

          const updatedRows = section.rows.map((row) => {
            if (row.children) {
              const hasChild = row.children.some((ch) => ch.categoryId === categoryId);
              if (hasChild) {
                const updatedChildren = row.children.map((ch) => {
                  if (ch.categoryId !== categoryId) return ch;
                  const newFactMonths = { ...ch.factMonths, [month]: amount };
                  return {
                    ...ch,
                    factMonths: newFactMonths,
                    factTotal: calculateRowTotal(newFactMonths),
                  };
                });

                const sumFact: MonthValues = {};
                const sumPlan: MonthValues = {};
                for (const m of MONTHS) {
                  sumFact[m.key] = updatedChildren.reduce((s, ch) => s + (ch.factMonths[m.key] || 0), 0);
                  sumPlan[m.key] = updatedChildren.reduce((s, ch) => s + (ch.months[m.key] || 0), 0);
                }

                return {
                  ...row,
                  children: updatedChildren,
                  months: sumPlan,
                  total: calculateRowTotal(sumPlan),
                  factMonths: sumFact,
                  factTotal: calculateRowTotal(sumFact),
                };
              }
            }

            if (row.categoryId !== categoryId || row.isCalculated) return row;
            const newFactMonths = { ...row.factMonths, [month]: amount };
            return {
              ...row,
              factMonths: newFactMonths,
              factTotal: calculateRowTotal(newFactMonths),
            };
          });

          const ncfRow = updatedRows.find((r) => r.isCalculated && !r.children);
          if (ncfRow) {
            const dataRows = updatedRows.filter((r) => !r.isCalculated || r.children);
            const factDataRows: BddsRow[] = dataRows.map((r) => ({
              ...r,
              months: r.factMonths,
            }));
            ncfRow.factMonths = calculateNetCashFlow(section.sectionCode, factDataRows);
            ncfRow.factTotal = calculateRowTotal(ncfRow.factMonths);
          }

          return { ...section, rows: [...updatedRows] };
        });

        next.set(yearFrom, updated);
        return next;
      });
    },
    [yearFrom]
  );

  const saveAll = useCallback(async () => {
    try {
      setSaving(true);
      const entries: Array<{
        category_id: string;
        year: number;
        month: number;
        amount: number;
        entry_type: 'fact';
        project_id?: string;
      }> = [];

      const secs = yearSections.get(yearFrom) ?? [];
      for (const section of secs) {
        for (const row of section.rows) {
          const rowsToSave = row.children ? row.children : (row.isCalculated ? [] : [row]);
          for (const r of rowsToSave) {
            if (r.isCalculated) continue;
            for (const m of MONTHS) {
              const amount = r.factMonths[m.key] || 0;
              if (amount !== 0 || dirtyFactRef.current.has(`${r.categoryId}_${m.key}`)) {
                const entry: typeof entries[number] = {
                  category_id: r.categoryId,
                  year: yearFrom,
                  month: m.key,
                  amount,
                  entry_type: 'fact',
                };
                if (projectId) entry.project_id = projectId;
                entries.push(entry);
              }
            }
          }
        }
      }

      await bddsService.upsertBatch(entries);
      dirtyFactRef.current.clear();
    } finally {
      setSaving(false);
    }
  }, [yearSections, yearFrom, projectId]);

  return { sections, yearSections, yearMonthSlots, loading, saving, error, expandedParents, toggleParent, updateFactEntry, saveAll };
}
