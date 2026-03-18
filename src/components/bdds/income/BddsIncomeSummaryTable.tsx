import { useMemo } from 'react';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { SummaryTableRow } from '../../../types/bddsIncome';
import { formatAmount } from '../../../utils/formatters';

interface IProps {
  rows: SummaryTableRow[];
  monthKeys: string[];
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const monthNames = [
    '', 'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
    'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
  ];
  const m = parseInt(month, 10);
  const shortYear = year.slice(2);
  return `${monthNames[m] || month}.${shortYear}`;
}

export const BddsIncomeSummaryTable = ({ rows, monthKeys }: IProps) => {
  const columns = useMemo((): ColumnsType<SummaryTableRow> => {
    const cols: ColumnsType<SummaryTableRow> = [
      {
        title: 'Наименование проекта',
        dataIndex: 'projectName',
        key: 'projectName',
        fixed: 'left',
        width: 200,
        onCell: (_, index) => {
          if (index === undefined) return {};
          if (index % 2 === 0) return { rowSpan: 2 };
          return { rowSpan: 0 };
        },
        render: (text: string) => <strong>{text}</strong>,
      },
      {
        title: '',
        dataIndex: 'rowLabel',
        key: 'rowLabel',
        fixed: 'left',
        width: 280,
        render: (text: string, record: SummaryTableRow) => {
          if (record.rowType === 'total_smr') return <strong>{text}</strong>;
          return <em>{text}</em>;
        },
      },
    ];

    for (const mk of monthKeys) {
      cols.push({
        title: formatMonthLabel(mk),
        dataIndex: mk,
        key: mk,
        width: 110,
        align: 'right',
        render: (value: unknown) => {
          const num = typeof value === 'number' ? value : 0;
          if (num === 0) return null;
          return (
            <span className={num < 0 ? 'amount-negative' : ''}>
              {formatAmount(num)}
            </span>
          );
        },
      });
    }

    cols.push({
      title: 'Итого',
      key: 'row_total',
      width: 130,
      align: 'right',
      className: 'bdds-total-cell',
      render: (_: unknown, record: SummaryTableRow) => {
        let sum = 0;
        for (const mk of monthKeys) {
          const val = record[mk];
          if (typeof val === 'number') sum += val;
        }
        if (sum === 0) return null;
        return (
          <span className={sum < 0 ? 'amount-negative' : ''}>
            {formatAmount(sum)}
          </span>
        );
      },
    });

    return cols;
  }, [monthKeys]);

  if (rows.length === 0) return null;

  return (
    <Table
      dataSource={rows}
      columns={columns}
      pagination={false}
      bordered
      size="small"
      scroll={{ x: 480 + monthKeys.length * 110 }}
      sticky
      rowClassName={(record) =>
        record.rowType === 'total_smr' ? 'bdds-calculated-row' : ''
      }
    />
  );
};
