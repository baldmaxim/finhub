import { useState, useEffect, useCallback, useRef } from 'react';
import type { BddsCategory, BddsSection, BddsRow, MonthValues } from '../types/bdds';
import * as bddsService from '../services/bddsService';
import * as bddsIncomeService from '../services/bddsIncomeService';
import { SECTION_ORDER, SECTION_NAMES, MONTHS } from '../utils/constants';
import { calculateNetCashFlow, calculateRowTotal } from '../utils/calculations';

interface IUseBddsResult {
  sections: BddsSection[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  expandedParents: Set<string>;
  toggleParent: (categoryId: string) => void;
  updateFactEntry: (categoryId: string, month: number, amount: number) => void;
  saveAll: () => Promise<void>;
}

export function useBdds(year: number, projectId: string | null = null): IUseBddsResult {
  const [sections, setSections] = useState<BddsSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const categoriesRef = useRef<BddsCategory[]>([]);
  const dirtyFactRef = useRef<Set<string>>(new Set());

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

        // Разделяем на родителей и детей
        const parentCats = sectionCategories.filter((c) => !c.parent_id);
        const childCats = sectionCategories.filter((c) => c.parent_id);

        const rows: BddsRow[] = parentCats.map((cat) => {
          let planMonths = planMap.get(cat.id) || {};
          const factMonths = factMap.get(cat.id) || {};

          // Автозаполнение плана только для доходов операционной секции
          if (sectionCode === 'operating' && cat.row_type === 'income' && !cat.is_calculated) {
            planMonths = { ...incomeTotals };
          }

          // Собираем дочерние строки
          const catChildren = childCats.filter((c) => c.parent_id === cat.id);
          let children: BddsRow[] | undefined;

          if (catChildren.length > 0) {
            children = catChildren.map((child) => ({
              categoryId: child.id,
              name: child.name,
              rowType: child.row_type,
              isCalculated: child.is_calculated,
              months: planMap.get(child.id) || {},
              total: calculateRowTotal(planMap.get(child.id) || {}),
              factMonths: factMap.get(child.id) || {},
              factTotal: calculateRowTotal(factMap.get(child.id) || {}),
              parentId: child.parent_id,
            }));

            // Родитель с formula=sum_children — сумма дочерних
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

        // Рассчитать ЧДП (план и факт)
        const ncfRow = rows.find((r) => r.isCalculated && !r.children);
        if (ncfRow) {
          const dataRows = rows.filter((r) => !r.isCalculated || r.children);
          ncfRow.months = calculateNetCashFlow(sectionCode, dataRows);
          ncfRow.total = calculateRowTotal(ncfRow.months);

          // ЧДП факт — рассчитать из факт-данных строк
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
      const [categories, planEntries, factEntries, incomeTotals] = await Promise.all([
        bddsService.getCategories(),
        bddsService.getEntries(year, 'plan', pid),
        bddsService.getEntries(year, 'fact', pid),
        bddsIncomeService.getIncomeTotalsByMonth(year, pid),
      ]);

      categoriesRef.current = categories;

      const planMap = new Map<string, MonthValues>();
      for (const entry of planEntries) {
        if (!planMap.has(entry.category_id)) {
          planMap.set(entry.category_id, {});
        }
        planMap.get(entry.category_id)![entry.month] = Number(entry.amount);
      }

      const factMap = new Map<string, MonthValues>();
      for (const entry of factEntries) {
        if (!factMap.has(entry.category_id)) {
          factMap.set(entry.category_id, {});
        }
        factMap.get(entry.category_id)![entry.month] = Number(entry.amount);
      }

      setSections(buildSections(categories, planMap, factMap, incomeTotals));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [year, projectId, buildSections]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateFactEntry = useCallback(
    (categoryId: string, month: number, amount: number) => {
      dirtyFactRef.current.add(`${categoryId}_${month}`);

      setSections((prev) =>
        prev.map((section) => {
          // Проверяем наличие категории в строках или дочерних
          const hasCategory = section.rows.some(
            (r) => r.categoryId === categoryId || r.children?.some((ch) => ch.categoryId === categoryId)
          );
          if (!hasCategory) return section;

          const updatedRows = section.rows.map((row) => {
            // Обновление дочерней строки
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

                // Пересчитать родителя
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

          // Пересчитать ЧДП факт
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
        })
      );
    },
    []
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

      for (const section of sections) {
        for (const row of section.rows) {
          const rowsToSave = row.children ? row.children : (row.isCalculated ? [] : [row]);
          for (const r of rowsToSave) {
            if (r.isCalculated) continue;
            for (const m of MONTHS) {
              const amount = r.factMonths[m.key] || 0;
              if (amount !== 0 || dirtyFactRef.current.has(`${r.categoryId}_${m.key}`)) {
                const entry: typeof entries[number] = {
                  category_id: r.categoryId,
                  year,
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
  }, [sections, year, projectId]);

  return { sections, loading, saving, error, expandedParents, toggleParent, updateFactEntry, saveAll };
}
