import type { ColumnsType } from 'antd/es/table';
import type { BddsTableRow } from '../../types/bdds';
import type { YearMonthSlot } from '../../utils/constants';
import { MONTHS } from '../../utils/constants';
import { formatAmount } from '../../utils/formatters';
import { BddsEditableCell } from './BddsEditableCell';

function formatPercent(plan: number, fact: number): string {
  if (!plan) return '';
  const abs = fact - plan;
  const pct = (abs / plan) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function formatDeviation(plan: number, fact: number): string {
  const abs = fact - plan;
  if (abs === 0 && !fact && !plan) return '';
  return formatAmount(abs);
}

interface IMonthColumnsOptions {
  onUpdateFact?: (categoryId: string, month: number, amount: number) => void;
  slots?: YearMonthSlot[];
}

export const buildMonthColumns = (
  options: IMonthColumnsOptions
): ColumnsType<BddsTableRow> => {
  const { onUpdateFact, slots } = options;
  const cols: ColumnsType<BddsTableRow> = [];

  const items = slots ?? MONTHS.map((m) => ({ year: 0, month: m.key, label: m.short, dataKey: String(m.key) }));

  for (const slot of items) {
    const dk = slot.dataKey;
    cols.push({
      title: slot.label,
      key: `month_group_${dk}`,
      children: [
        {
          title: 'План',
          dataIndex: `plan_month_${dk}`,
          key: `plan_${dk}`,
          width: 80,
          align: 'right',
          className: 'bdds-plan-cell',
          render: (_: unknown, record: BddsTableRow) => {
            if (record.isHeader) return null;
            const value = record[`plan_month_${dk}`] as number;
            const display = formatAmount(value);
            return (
              <span className={value < 0 ? 'amount-negative' : ''}>
                {display}
              </span>
            );
          },
        },
        {
          title: 'Факт',
          dataIndex: `fact_month_${dk}`,
          key: `fact_${dk}`,
          width: 80,
          align: 'right',
          className: 'bdds-fact-cell',
          render: (_: unknown, record: BddsTableRow) => {
            if (record.isHeader) return null;
            const value = record[`fact_month_${dk}`] as number;
            const isAutoIncome = record.rowType === 'income' && record.sectionCode === 'operating';
            const readOnly = record.isCalculated || isAutoIncome || !onUpdateFact;
            return (
              <BddsEditableCell
                value={value}
                isCalculated={readOnly}
                onSave={(newValue) => {
                  if (record.categoryId) {
                    onUpdateFact?.(record.categoryId, slot.month, newValue);
                  }
                }}
              />
            );
          },
        },
        {
          title: 'Абс.',
          key: `abs_${dk}`,
          width: 80,
          align: 'right',
          className: 'bdds-abs-cell',
          render: (_: unknown, record: BddsTableRow) => {
            if (record.isHeader) return null;
            const plan = (record[`plan_month_${dk}`] as number) || 0;
            const fact = (record[`fact_month_${dk}`] as number) || 0;
            const display = formatDeviation(plan, fact);
            const abs = fact - plan;
            return (
              <span className={abs < 0 ? 'amount-negative' : ''}>
                {display}
              </span>
            );
          },
        },
        {
          title: '%',
          key: `rel_${dk}`,
          width: 55,
          align: 'right',
          className: 'bdds-rel-cell',
          render: (_: unknown, record: BddsTableRow) => {
            if (record.isHeader) return null;
            const plan = (record[`plan_month_${dk}`] as number) || 0;
            const fact = (record[`fact_month_${dk}`] as number) || 0;
            const display = formatPercent(plan, fact);
            const abs = fact - plan;
            return (
              <span className={abs < 0 ? 'amount-negative' : ''}>
                {display}
              </span>
            );
          },
        },
      ],
    });
  }

  return cols;
}

export const buildTotalColumns = (): ColumnsType<BddsTableRow> => {
  return [
    {
      title: 'Итого',
      key: 'total_group',
      className: 'bdds-total-cell',
      children: [
        {
          title: 'План',
          dataIndex: 'plan_total',
          key: 'plan_total',
          width: 90,
          align: 'right',
          className: 'bdds-total-cell bdds-total-border-left',
          render: (value: number, record: BddsTableRow) => {
            if (record.isHeader) return null;
            return (
              <span className={value < 0 ? 'amount-negative' : ''}>
                {formatAmount(value)}
              </span>
            );
          },
        },
        {
          title: 'Факт',
          dataIndex: 'fact_total',
          key: 'fact_total',
          width: 90,
          align: 'right',
          className: 'bdds-total-cell',
          render: (value: number, record: BddsTableRow) => {
            if (record.isHeader) return null;
            return (
              <span className={value < 0 ? 'amount-negative' : ''}>
                {formatAmount(value)}
              </span>
            );
          },
        },
        {
          title: 'Абс.',
          key: 'abs_total',
          width: 80,
          align: 'right',
          className: 'bdds-total-cell',
          render: (_: unknown, record: BddsTableRow) => {
            if (record.isHeader) return null;
            const plan = (record.plan_total as number) || 0;
            const fact = (record.fact_total as number) || 0;
            const display = formatDeviation(plan, fact);
            const abs = fact - plan;
            return (
              <span className={abs < 0 ? 'amount-negative' : ''}>
                {display}
              </span>
            );
          },
        },
        {
          title: '%',
          key: 'rel_total',
          width: 55,
          align: 'right',
          className: 'bdds-total-cell',
          render: (_: unknown, record: BddsTableRow) => {
            if (record.isHeader) return null;
            const plan = (record.plan_total as number) || 0;
            const fact = (record.fact_total as number) || 0;
            const display = formatPercent(plan, fact);
            const abs = fact - plan;
            return (
              <span className={abs < 0 ? 'amount-negative' : ''}>
                {display}
              </span>
            );
          },
        },
      ],
    },
  ];
}
