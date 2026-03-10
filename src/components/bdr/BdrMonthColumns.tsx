import type { ColumnsType } from 'antd/es/table';
import type { BdrTableRow } from '../../types/bdr';
import type { YearMonthSlot } from '../../utils/constants';
import { MONTHS } from '../../utils/constants';
import { formatAmount } from '../../utils/formatters';
import { BddsEditableCell } from '../bdds/BddsEditableCell';

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

function formatPercentValue(value: number): string {
  if (!value) return '';
  return `${value.toFixed(1)}%`;
}

interface IMonthColumnsOptions {
  onUpdatePlan?: (rowCode: string, month: number, amount: number) => void;
  onUpdateFact?: (rowCode: string, month: number, amount: number) => void;
  slots?: YearMonthSlot[];
}

export const buildBdrMonthColumns = (options: IMonthColumnsOptions): ColumnsType<BdrTableRow> => {
  const { onUpdatePlan, onUpdateFact, slots } = options;
  const cols: ColumnsType<BdrTableRow> = [];

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
          render: (_: unknown, record: BdrTableRow) => {
            if (record.isHeader || record.noPlan) return null;
            const value = record[`plan_month_${dk}`] as number;

            if (record.isPercent) {
              return <span>{formatPercentValue(value)}</span>;
            }

            const readOnly = record.isCalculated || !!record.isPlanCalculated || !onUpdatePlan;
            return (
              <BddsEditableCell
                value={value}
                isCalculated={readOnly}
                onSave={(v) => onUpdatePlan?.(record.rowCode, slot.month, v)}
              />
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
          render: (_: unknown, record: BdrTableRow) => {
            if (record.isHeader) return null;
            const value = record[`fact_month_${dk}`] as number;

            if (record.isPercent) {
              return <span>{formatPercentValue(value)}</span>;
            }

            const readOnly = record.isCalculated || !!record.isClickable || !onUpdateFact;
            return (
              <BddsEditableCell
                value={value}
                isCalculated={readOnly}
                onSave={(v) => onUpdateFact?.(record.rowCode, slot.month, v)}
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
          render: (_: unknown, record: BdrTableRow) => {
            if (record.isHeader || record.noPlan) return null;
            const plan = (record[`plan_month_${dk}`] as number) || 0;
            const fact = (record[`fact_month_${dk}`] as number) || 0;
            const abs = fact - plan;
            if (record.isPercent) {
              if (!abs && !fact && !plan) return null;
              return <span className={abs < 0 ? 'amount-negative' : ''}>{formatPercentValue(abs)}</span>;
            }
            return (
              <span className={abs < 0 ? 'amount-negative' : ''}>
                {formatDeviation(plan, fact)}
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
          render: (_: unknown, record: BdrTableRow) => {
            if (record.isHeader || record.isPercent || record.noPlan) return null;
            const plan = (record[`plan_month_${dk}`] as number) || 0;
            const fact = (record[`fact_month_${dk}`] as number) || 0;
            const abs = fact - plan;
            return (
              <span className={abs < 0 ? 'amount-negative' : ''}>
                {formatPercent(plan, fact)}
              </span>
            );
          },
        },
      ],
    });
  }

  return cols;
}

export const buildBdrTotalColumns = (): ColumnsType<BdrTableRow> => {
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
          render: (value: number, record: BdrTableRow) => {
            if (record.isHeader || record.noPlan) return null;
            if (record.isPercent) return null;
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
          render: (value: number, record: BdrTableRow) => {
            if (record.isHeader) return null;
            if (record.isPercent) return null;
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
          render: (_: unknown, record: BdrTableRow) => {
            if (record.isHeader || record.noPlan) return null;
            const plan = (record.plan_total as number) || 0;
            const fact = (record.fact_total as number) || 0;
            const abs = fact - plan;
            if (record.isPercent) {
              if (!abs && !fact && !plan) return null;
              return <span className={abs < 0 ? 'amount-negative' : ''}>{formatPercentValue(abs)}</span>;
            }
            return (
              <span className={abs < 0 ? 'amount-negative' : ''}>
                {formatDeviation(plan, fact)}
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
          render: (_: unknown, record: BdrTableRow) => {
            if (record.isHeader || record.isPercent || record.noPlan) return null;
            const plan = (record.plan_total as number) || 0;
            const fact = (record.fact_total as number) || 0;
            const abs = fact - plan;
            return (
              <span className={abs < 0 ? 'amount-negative' : ''}>
                {formatPercent(plan, fact)}
              </span>
            );
          },
        },
      ],
    },
  ];
}
