import { Tooltip } from 'antd';
import { WarningFilled } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { BdrSubType } from '../../types/bdr';
import type { YearMonthSlot } from '../../utils/constants';
import type { IBdrTreeRow } from '../../utils/bdrSections';
import { BDR_FORMULAS, isOverBudget } from '../../utils/bdrSections';
import { MONTHS } from '../../utils/constants';
import { formatAmount } from '../../utils/formatters';
import { BddsEditableCell } from '../bdds/BddsEditableCell';

function formatPercent(plan: number, fact: number): string {
  if (!plan) return '';
  const pct = ((fact - plan) / plan) * 100;
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

/** CSS-класс для условного форматирования ячейки */
function getAlertClass(record: IBdrTreeRow, dk: string): string {
  if (record.isSectionHeader || record.isPercent) return '';
  const plan = (record[`plan_month_${dk}`] as number) || 0;
  const fact = (record[`fact_month_${dk}`] as number) || 0;

  // Расходные статьи: факт > план = перерасход
  const costCodes = ['cost_materials', 'cost_labor', 'cost_subcontract', 'cost_design', 'cost_rental', 'cost_overhead', 'direct_cost_total'];
  if (costCodes.includes(record.rowCode) && isOverBudget(plan, fact)) {
    return 'bdr-cell-alert';
  }
  return '';
}

/** Рендер с warning-иконкой при перерасходе */
function renderAlertValue(
  value: string, record: IBdrTreeRow, dk: string, readinessRow?: IBdrTreeRow
): React.ReactNode {
  const plan = (record[`plan_month_${dk}`] as number) || 0;
  const fact = (record[`fact_month_${dk}`] as number) || 0;

  // Субподряд обгоняет % готовности
  if (record.rowCode === 'cost_subcontract' && readinessRow && plan > 0) {
    const subPct = (fact / plan) * 100;
    const readinessFact = (readinessRow[`fact_month_${dk}`] as number) || 0;
    if (subPct > readinessFact && subPct > 0) {
      return (
        <Tooltip title={`Субподряд ${subPct.toFixed(0)}% > Готовность ${readinessFact.toFixed(0)}%`}>
          <span className="bdr-cell-alert-text">
            <WarningFilled className="bdr-alert-icon" /> {value}
          </span>
        </Tooltip>
      );
    }
  }

  // Перерасход > 100%
  const costCodes = ['cost_materials', 'cost_labor', 'cost_subcontract', 'cost_design', 'cost_rental', 'cost_overhead', 'direct_cost_total'];
  if (costCodes.includes(record.rowCode) && isOverBudget(plan, fact)) {
    const pct = ((fact / plan) * 100).toFixed(0);
    return (
      <Tooltip title={`Перерасход: факт ${pct}% от плана`}>
        <span className="bdr-cell-alert-text">
          <WarningFilled className="bdr-alert-icon" /> {value}
        </span>
      </Tooltip>
    );
  }

  return value;
}

interface ITreeColumnsOptions {
  onUpdatePlan?: (rowCode: string, month: number, amount: number) => void;
  onUpdateFact?: (rowCode: string, month: number, amount: number) => void;
  onOpenSub: (subType: BdrSubType) => void;
  onOpenFixedPlan?: () => void;
  slots?: YearMonthSlot[];
  readinessRow?: IBdrTreeRow;
}

export const buildBdrTreeNameColumn = (
  onOpenSub: (subType: BdrSubType) => void,
  onOpenFixedPlan?: () => void,
): ColumnsType<IBdrTreeRow>[0] => ({
  title: 'Статья БДР',
  dataIndex: 'name',
  key: 'name',
  width: 340,
  fixed: 'left',
  render: (_: unknown, record: IBdrTreeRow) => {
    const formula = BDR_FORMULAS[record.rowCode];
    const nameContent = (() => {
      // Секция-заголовок с кликабельной подстрокой (V. OPEX)
      if (record.isSectionHeader && record.isClickable && record.subType) {
        if (record.rowCode === 'fixed_expenses' && onOpenFixedPlan) {
          return (
            <strong className="bdr-tree-section-name">
              <span className="bdr-clickable-name" onClick={() => onOpenSub(record.subType!)}>
                {record.name}
              </span>
              {' '}
              <span className="bdr-clickable-name bdr-plan-link" onClick={onOpenFixedPlan}>
                [импорт]
              </span>
            </strong>
          );
        }
        return (
          <strong className="bdr-tree-section-name bdr-clickable-name" onClick={() => onOpenSub(record.subType!)}>
            {record.name}
          </strong>
        );
      }

      if (record.isSectionHeader) {
        return <strong className="bdr-tree-section-name">{record.name}</strong>;
      }

      if (record.isClickable && record.subType) {
        if (record.rowCode === 'fixed_expenses' && onOpenFixedPlan) {
          return (
            <span>
              <span className="bdr-clickable-name" onClick={() => onOpenSub(record.subType!)}>
                {record.name}
              </span>
              {' '}
              <span className="bdr-clickable-name bdr-plan-link" onClick={onOpenFixedPlan}>
                [импорт]
              </span>
            </span>
          );
        }
        return (
          <span
            className="bdr-clickable-name bdr-tree-child-indent"
            onClick={() => onOpenSub(record.subType!)}
          >
            {record.name}
          </span>
        );
      }

      if (record.isPercent) {
        return <span className="bdr-tree-child-indent bdr-percent-row-name">{record.name}</span>;
      }

      return <span className="bdr-tree-child-indent">{record.name}</span>;
    })();

    if (formula) {
      return (
        <Tooltip title={formula} placement="right" mouseEnterDelay={0.3}>
          <span className="bdr-formula-hint">{nameContent}</span>
        </Tooltip>
      );
    }

    return nameContent;
  },
});

export const buildBdrTreeMonthColumns = (options: ITreeColumnsOptions): ColumnsType<IBdrTreeRow> => {
  const { onUpdatePlan, onUpdateFact, slots, readinessRow } = options;
  const cols: ColumnsType<IBdrTreeRow> = [];

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
          onCell: (record: IBdrTreeRow) => ({
            className: [
              'bdds-plan-cell',
              record.isSectionHeader ? 'bdr-tree-section-cell' : '',
            ].filter(Boolean).join(' '),
          }),
          render: (_: unknown, record: IBdrTreeRow) => {
            if (record.noPlan) return null;
            const value = record[`plan_month_${dk}`] as number;
            if (record.isPercent) return <span>{formatPercentValue(value)}</span>;
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
          onCell: (record: IBdrTreeRow) => ({
            className: [
              'bdds-fact-cell',
              record.isSectionHeader ? 'bdr-tree-section-cell' : '',
              getAlertClass(record, dk),
            ].filter(Boolean).join(' '),
          }),
          render: (_: unknown, record: IBdrTreeRow) => {
            const value = record[`fact_month_${dk}`] as number;
            if (record.isPercent) return <span>{formatPercentValue(value)}</span>;
            const readOnly = record.isCalculated || !!record.isClickable || !onUpdateFact;
            const formatted = (
              <BddsEditableCell
                value={value}
                isCalculated={readOnly}
                onSave={(v) => onUpdateFact?.(record.rowCode, slot.month, v)}
              />
            );
            if (readOnly && typeof value === 'number') {
              const display = formatAmount(value);
              return renderAlertValue(display, record, dk, readinessRow);
            }
            return formatted;
          },
        },
        {
          title: 'Абс.',
          key: `abs_${dk}`,
          width: 80,
          align: 'right',
          className: 'bdds-abs-cell',
          render: (_: unknown, record: IBdrTreeRow) => {
            if (record.noPlan) return null;
            const plan = (record[`plan_month_${dk}`] as number) || 0;
            const fact = (record[`fact_month_${dk}`] as number) || 0;
            const abs = fact - plan;
            if (record.isPercent) {
              if (!abs && !fact && !plan) return null;
              return <span className={abs < 0 ? 'amount-negative' : ''}>{formatPercentValue(abs)}</span>;
            }
            return (
              <span className={abs < 0 ? 'amount-negative' : ''}>{formatDeviation(plan, fact)}</span>
            );
          },
        },
        {
          title: '%',
          key: `rel_${dk}`,
          width: 55,
          align: 'right',
          className: 'bdds-rel-cell',
          render: (_: unknown, record: IBdrTreeRow) => {
            if (record.isPercent || record.noPlan) return null;
            const plan = (record[`plan_month_${dk}`] as number) || 0;
            const fact = (record[`fact_month_${dk}`] as number) || 0;
            const abs = fact - plan;
            return (
              <span className={abs < 0 ? 'amount-negative' : ''}>{formatPercent(plan, fact)}</span>
            );
          },
        },
      ],
    });
  }

  return cols;
};

export const buildBdrTreeTotalColumns = (_readinessRow?: IBdrTreeRow): ColumnsType<IBdrTreeRow> => [
  {
    title: 'Итого',
    key: 'total_group',
    fixed: 'right',
    className: 'bdds-total-cell',
    children: [
      {
        title: 'План',
        dataIndex: 'plan_total',
        key: 'plan_total',
        width: 90,
        align: 'right',
        className: 'bdds-total-cell bdds-total-border-left',
        render: (value: number, record: IBdrTreeRow) => {
          if (record.noPlan || record.isPercent) return null;
          return <span className={value < 0 ? 'amount-negative' : ''}>{formatAmount(value)}</span>;
        },
      },
      {
        title: 'Факт',
        dataIndex: 'fact_total',
        key: 'fact_total',
        width: 90,
        align: 'right',
        className: 'bdds-total-cell',
        onCell: (record: IBdrTreeRow) => {
          const plan = (record.plan_total as number) || 0;
          const fact = (record.fact_total as number) || 0;
          const costCodes = ['cost_materials', 'cost_labor', 'cost_subcontract', 'cost_design', 'cost_rental', 'cost_overhead', 'direct_cost_total'];
          const alert = !record.isPercent && costCodes.includes(record.rowCode) && isOverBudget(plan, fact);
          return { className: ['bdds-total-cell', alert ? 'bdr-cell-alert' : ''].filter(Boolean).join(' ') };
        },
        render: (value: number, record: IBdrTreeRow) => {
          if (record.isPercent) return null;
          const plan = (record.plan_total as number) || 0;
          const display = formatAmount(value);
          const costCodes = ['cost_materials', 'cost_labor', 'cost_subcontract', 'cost_design', 'cost_rental', 'cost_overhead', 'direct_cost_total'];
          if (costCodes.includes(record.rowCode) && isOverBudget(plan, value)) {
            const pct = ((value / plan) * 100).toFixed(0);
            return (
              <Tooltip title={`Перерасход итого: ${pct}% от плана`}>
                <span className="bdr-cell-alert-text">
                  <WarningFilled className="bdr-alert-icon" /> {display}
                </span>
              </Tooltip>
            );
          }
          return <span className={value < 0 ? 'amount-negative' : ''}>{display}</span>;
        },
      },
      {
        title: 'Абс.',
        key: 'abs_total',
        width: 80,
        align: 'right',
        className: 'bdds-total-cell',
        render: (_: unknown, record: IBdrTreeRow) => {
          if (record.noPlan || record.isPercent) return null;
          const plan = (record.plan_total as number) || 0;
          const fact = (record.fact_total as number) || 0;
          return (
            <span className={fact - plan < 0 ? 'amount-negative' : ''}>{formatDeviation(plan, fact)}</span>
          );
        },
      },
      {
        title: '%',
        key: 'rel_total',
        width: 55,
        align: 'right',
        className: 'bdds-total-cell',
        render: (_: unknown, record: IBdrTreeRow) => {
          if (record.isPercent || record.noPlan) return null;
          const plan = (record.plan_total as number) || 0;
          const fact = (record.fact_total as number) || 0;
          return (
            <span className={fact - plan < 0 ? 'amount-negative' : ''}>{formatPercent(plan, fact)}</span>
          );
        },
      },
    ],
  },
];
