import { useMemo } from 'react';
import { Table } from 'antd';
import { RightOutlined, DownOutlined } from '@ant-design/icons';
import type { BdrTableRow, BdrSubType } from '../../types/bdr';
import type { YearMonthSlot } from '../../utils/constants';
import { buildBdrMonthColumns, buildBdrTotalColumns } from './BdrMonthColumns';

interface IProps {
  rows: BdrTableRow[];
  yearRows?: Map<number, BdrTableRow[]>;
  yearMonthSlots?: YearMonthSlot[];
  overheadExpanded: boolean;
  costExpanded: boolean;
  onToggleOverhead: () => void;
  onToggleCost: () => void;
  onUpdatePlan?: (rowCode: string, month: number, amount: number) => void;
  onUpdateFact?: (rowCode: string, month: number, amount: number) => void;
  onOpenSub: (subType: BdrSubType) => void;
  onOpenFixedPlan?: () => void;
}

export const BdrTable = ({ rows, yearRows, yearMonthSlots, overheadExpanded, costExpanded, onToggleOverhead, onToggleCost, onUpdatePlan, onUpdateFact, onOpenSub, onOpenFixedPlan }: IProps) => {
  const isMultiYear = yearMonthSlots ? yearMonthSlots.length > 12 : false;

  const dataSource = useMemo((): BdrTableRow[] => {
    if (!isMultiYear || !yearRows || !yearMonthSlots) {
      return rows;
    }

    // Multi-year: merge per-year rows into single rows with year-month dataKeys
    const firstYear = [...yearRows.keys()].sort((a, b) => a - b)[0];
    const baseRows = yearRows.get(firstYear) ?? [];

    return baseRows.map((baseRow, ri) => {
      if (baseRow.isHeader) return baseRow;

      const merged: BdrTableRow = {
        ...baseRow,
        plan_total: 0,
        fact_total: 0,
      };

      // Удаляем старые plan_month_N / fact_month_N ключи
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

  const columns = useMemo(() => {
    const nameCol = {
      title: 'Статья',
      dataIndex: 'name',
      key: 'name',
      width: 320,
      fixed: 'left' as const,
      render: (_: unknown, record: BdrTableRow) => {
        if (record.isHeader) {
          return <strong>{record.name}</strong>;
        }

        if (record.isCostParent) {
          return (
            <span
              className="bdr-clickable-name bdr-semibold-name"
              onClick={onToggleCost}
            >
              {costExpanded ? <DownOutlined /> : <RightOutlined />}
              {' '}{record.name}
            </span>
          );
        }

        if (record.isOverhead) {
          return (
            <span
              className="bdr-clickable-name"
              onClick={onToggleOverhead}
            >
              {overheadExpanded ? <DownOutlined /> : <RightOutlined />}
              {' '}{record.name}
            </span>
          );
        }

        if (record.isClickable && record.subType) {
          // ОФЗ: две ссылки — на факт (sub modal) и план (годовая сумма)
          if (record.rowCode === 'fixed_expenses' && onOpenFixedPlan) {
            return (
              <span>
                <span
                  className="bdr-clickable-name"
                  onClick={() => onOpenSub(record.subType!)}
                >
                  {record.name}
                </span>
                {' '}
                <span
                  className="bdr-clickable-name"
                  style={{ fontSize: 11, color: '#1677ff' }}
                  onClick={onOpenFixedPlan}
                >
                  [годовой факт]
                </span>
              </span>
            );
          }
          const clsList = ['bdr-clickable-name'];
          if (record.isOverheadItem) clsList.push('bdr-overhead-indent');
          else if (record.isCostChild) clsList.push('bdr-cost-indent');
          const cls = clsList.join(' ');
          return (
            <span
              className={cls}
              onClick={() => onOpenSub(record.subType!)}
            >
              {record.name}
            </span>
          );
        }

        if (record.isOverheadItem) {
          return <span className="bdr-overhead-indent">{record.name}</span>;
        }

        if (record.isSemiBold) {
          return <span className="bdr-semibold-name">{record.name}</span>;
        }

        return record.name;
      },
    };

    const monthCols = buildBdrMonthColumns({
      onUpdatePlan,
      onUpdateFact,
      slots: isMultiYear ? yearMonthSlots : undefined,
    });
    const totalCols = buildBdrTotalColumns();

    return [nameCol, ...monthCols, ...totalCols];
  }, [overheadExpanded, costExpanded, onToggleOverhead, onToggleCost, onUpdatePlan, onUpdateFact, onOpenSub, onOpenFixedPlan, isMultiYear, yearMonthSlots]);

  const rowClassName = (record: BdrTableRow) => {
    const classes: string[] = [];
    if (record.isHeader) classes.push('bdr-header-row');
    if (record.isSemiBold) classes.push('bdr-semibold-row');
    if (record.isCalculated && !record.isHeader) classes.push('bdr-calculated-row');
    if (record.isKeyMetric) classes.push('bdr-key-metric');
    if (record.isOverheadItem) classes.push('bdr-overhead-item');
    if (record.isCostChild) classes.push('bdr-cost-child');
    return classes.join(' ');
  };

  return (
    <Table<BdrTableRow>
      columns={columns}
      dataSource={dataSource}
      pagination={false}
      size="small"
      bordered
      scroll={{ x: 'max-content' }}
      sticky
      rowClassName={rowClassName}
      rowKey="key"
    />
  );
};
