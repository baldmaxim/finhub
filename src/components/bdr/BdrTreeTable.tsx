import { useMemo } from 'react';
import { Table } from 'antd';
import type { BdrTableRow, BdrSubType } from '../../types/bdr';
import type { YearMonthSlot } from '../../utils/constants';
import type { IBdrTreeRow } from '../../utils/bdrSections';
import { buildBdrTree, filterEmptyRows } from '../../utils/bdrSections';
import {
  buildBdrTreeNameColumn,
  buildBdrTreeMonthColumns,
  buildBdrTreeTotalColumns,
} from './BdrTreeColumns';

interface IProps {
  rows: BdrTableRow[];
  yearRows?: Map<number, BdrTableRow[]>;
  yearMonthSlots?: YearMonthSlot[];
  hideEmpty: boolean;
  onUpdatePlan?: (rowCode: string, month: number, amount: number) => void;
  onUpdateFact?: (rowCode: string, month: number, amount: number) => void;
  onOpenSub: (subType: BdrSubType) => void;
  onOpenFixedPlan?: () => void;
}

export const BdrTreeTable = ({
  rows,
  yearRows,
  yearMonthSlots,
  hideEmpty,
  onUpdatePlan,
  onUpdateFact,
  onOpenSub,
  onOpenFixedPlan,
}: IProps) => {
  const isMultiYear = yearMonthSlots ? yearMonthSlots.length > 12 : false;

  /** Объединение multi-year данных в единые строки */
  const flatRows = useMemo((): BdrTableRow[] => {
    if (!isMultiYear || !yearRows || !yearMonthSlots) return rows;

    const firstYear = [...yearRows.keys()].sort((a, b) => a - b)[0];
    const baseRows = yearRows.get(firstYear) ?? [];

    return baseRows.map((baseRow, ri) => {
      if (baseRow.isHeader) return baseRow;

      const merged: BdrTableRow = { ...baseRow, plan_total: 0, fact_total: 0 };
      for (let m = 1; m <= 12; m++) {
        delete merged[`plan_month_${m}`];
        delete merged[`fact_month_${m}`];
      }

      let planTotal = 0;
      let factTotal = 0;

      for (const slot of yearMonthSlots) {
        const yRows = yearRows.get(slot.year);
        const yRow = yRows?.[ri];
        const pv = (yRow?.[`plan_month_${slot.month}`] as number) || 0;
        const fv = (yRow?.[`fact_month_${slot.month}`] as number) || 0;
        merged[`plan_month_${slot.dataKey}`] = pv;
        merged[`fact_month_${slot.dataKey}`] = fv;
        if (!baseRow.isPercent) {
          planTotal += pv;
          factTotal += fv;
        }
      }

      merged.plan_total = baseRow.isPercent ? 0 : planTotal;
      merged.fact_total = baseRow.isPercent ? 0 : factTotal;
      return merged;
    });
  }, [rows, yearRows, yearMonthSlots, isMultiYear]);

  /** Строка % готовности для проверок субподряда */
  const readinessRow = useMemo((): IBdrTreeRow | undefined => {
    return flatRows.find((r) => r.rowCode === 'readiness_percent') as IBdrTreeRow | undefined;
  }, [flatRows]);

  /** Формирование дерева секций */
  const treeData = useMemo((): IBdrTreeRow[] => {
    let tree = buildBdrTree(flatRows);
    if (hideEmpty) tree = filterEmptyRows(tree);
    return tree;
  }, [flatRows, hideEmpty]);

  const columns = useMemo(() => {
    const nameCol = buildBdrTreeNameColumn(onOpenSub, onOpenFixedPlan);
    const monthCols = buildBdrTreeMonthColumns({
      onUpdatePlan,
      onUpdateFact,
      onOpenSub,
      onOpenFixedPlan,
      slots: isMultiYear ? yearMonthSlots : undefined,
      readinessRow,
    });
    const totalCols = buildBdrTreeTotalColumns(readinessRow);
    return [nameCol, ...monthCols, ...totalCols];
  }, [onUpdatePlan, onUpdateFact, onOpenSub, onOpenFixedPlan, isMultiYear, yearMonthSlots, readinessRow]);

  const rowClassName = (record: IBdrTreeRow) => {
    const classes: string[] = [];
    if (record.isSectionHeader) classes.push('bdr-tree-section-row');
    if (record.isProfit) classes.push('bdr-tree-profit-row');
    if (record.isKeyMetric) classes.push('bdr-key-metric');
    if (record.isPercent && !record.isSectionHeader) classes.push('bdr-tree-percent-row');
    return classes.join(' ');
  };

  return (
    <Table<IBdrTreeRow>
      columns={columns}
      dataSource={treeData}
      pagination={false}
      size="small"
      bordered
      scroll={{ x: 'max-content' }}
      sticky
      rowClassName={rowClassName}
      rowKey="key"
      expandable={{
        defaultExpandedRowKeys: [],
        indentSize: 0,
      }}
    />
  );
};
