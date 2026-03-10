import { useMemo } from 'react';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { IncomeTableRow } from '../../../types/bddsIncome';
import { formatAmount } from '../../../utils/formatters';

interface IProps {
  rows: IncomeTableRow[];
  monthKeys: string[];
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const monthNames = [
    '', 'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
    'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
  ];
  const m = parseInt(month, 10);
  return `${monthNames[m] || month} ${year}`;
}

export const BddsIncomeTable = ({ rows, monthKeys }: IProps) => {
  const columns = useMemo((): ColumnsType<IncomeTableRow> => {
    const cols: ColumnsType<IncomeTableRow> = [
      {
        title: 'Наименование',
        dataIndex: 'name',
        key: 'name',
        fixed: 'left',
        width: 300,
        render: (text: string, record: IncomeTableRow) => {
          if (record.isHeader) return <strong>{text}</strong>;
          if (record.isCalculated) return <strong>{text}</strong>;
          return text;
        },
      },
      {
        title: 'Примечание ДС',
        dataIndex: 'note',
        key: 'note',
        width: 150,
        render: (text: string, record: IncomeTableRow) => {
          if (record.isHeader) return null;
          return text;
        },
      },
    ];

    for (const mk of monthKeys) {
      cols.push({
        title: formatMonthLabel(mk),
        dataIndex: mk,
        key: mk,
        width: 120,
        align: 'right',
        className: 'bdds-income-month-cell',
        render: (value: unknown, record: IncomeTableRow) => {
          if (record.isHeader) return null;
          const num = typeof value === 'number' ? value : 0;
          const display = formatAmount(num);
          return (
            <span className={num < 0 ? 'amount-negative' : ''}>
              {display}
            </span>
          );
        },
      });
    }

    // Итого по строке
    cols.push({
      title: 'Итого',
      key: 'row_total',
      width: 140,
      align: 'right',
      className: 'bdds-total-cell',
      render: (_: unknown, record: IncomeTableRow) => {
        if (record.isHeader) return null;
        let sum = 0;
        for (const mk of monthKeys) {
          const val = record[mk];
          if (typeof val === 'number') sum += val;
        }
        const display = formatAmount(sum);
        return (
          <span className={sum < 0 ? 'amount-negative' : ''}>
            {display}
          </span>
        );
      },
    });

    return cols;
  }, [monthKeys]);

  return (
    <Table
      dataSource={rows}
      columns={columns}
      pagination={false}
      bordered
      size="small"
      scroll={{ x: 500 + monthKeys.length * 120 }}
      sticky
      rowClassName={(record) => {
        if (record.isHeader) return 'bdds-section-header';
        if (record.isCalculated) return 'bdds-calculated-row';
        return '';
      }}
    />
  );
}
