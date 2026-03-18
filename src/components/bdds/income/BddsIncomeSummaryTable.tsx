import { useMemo, useCallback } from 'react';
import { Table, Typography, Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
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

function renderAmount(value: unknown) {
  const num = typeof value === 'number' ? value : 0;
  if (num === 0) return null;
  return (
    <span className={num < 0 ? 'amount-negative' : ''}>
      {formatAmount(num)}
    </span>
  );
}

const buildColumns = (monthKeys: string[]): ColumnsType<SummaryTableRow> => {
  const cols: ColumnsType<SummaryTableRow> = [
    {
      title: 'Наименование проекта',
      dataIndex: 'projectName',
      key: 'projectName',
      fixed: 'left',
      width: 250,
      render: (text: string, record: SummaryTableRow) => {
        if (record.key === 'total_row') return <strong>{text}</strong>;
        return text;
      },
    },
  ];

  for (const mk of monthKeys) {
    cols.push({
      title: formatMonthLabel(mk),
      dataIndex: mk,
      key: mk,
      align: 'right',
      render: renderAmount,
    });
  }

  cols.push({
    title: 'Итого',
    key: 'row_total',
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
          <strong>{formatAmount(sum)}</strong>
        </span>
      );
    },
  });

  return cols;
};

const buildTotalRow = (
  rows: SummaryTableRow[],
  monthKeys: string[],
  rowType: 'total_smr' | 'total_income',
): SummaryTableRow => {
  const totalRow: SummaryTableRow = {
    key: 'total_row',
    projectName: 'Итого',
    projectId: '',
    rowLabel: '',
    rowType,
  };
  for (const mk of monthKeys) {
    let sum = 0;
    for (const r of rows) {
      const val = r[mk];
      if (typeof val === 'number') sum += val;
    }
    if (sum !== 0) totalRow[mk] = sum;
  }
  return totalRow;
};

export const BddsIncomeSummaryTable = ({ rows, monthKeys }: IProps) => {
  const smrRows = useMemo(() => rows.filter((r) => r.rowType === 'total_smr'), [rows]);
  const incomeRows = useMemo(() => rows.filter((r) => r.rowType === 'total_income'), [rows]);

  const smrWithTotal = useMemo(
    () => [...smrRows, buildTotalRow(smrRows, monthKeys, 'total_smr')],
    [smrRows, monthKeys],
  );
  const incomeWithTotal = useMemo(
    () => [...incomeRows, buildTotalRow(incomeRows, monthKeys, 'total_income')],
    [incomeRows, monthKeys],
  );

  const columns = useMemo(() => buildColumns(monthKeys), [monthKeys]);

  const exportToExcel = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const headers = ['Наименование проекта', ...monthKeys.map(formatMonthLabel), 'Итого'];

    const toSheet = (data: SummaryTableRow[]) => {
      const sheetData = [headers];
      for (const row of data) {
        const rowTotal = monthKeys.reduce((s, mk) => {
          const v = row[mk];
          return s + (typeof v === 'number' ? v : 0);
        }, 0);
        sheetData.push([
          row.projectName,
          ...monthKeys.map((mk) => {
            const v = row[mk];
            return typeof v === 'number' ? v : '';
          }),
          rowTotal || '',
        ] as string[]);
      }
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      // Ширина колонок
      ws['!cols'] = [{ wch: 30 }, ...monthKeys.map(() => ({ wch: 15 })), { wch: 18 }];
      return ws;
    };

    XLSX.utils.book_append_sheet(wb, toSheet(smrWithTotal), 'Всего СМР');
    XLSX.utils.book_append_sheet(wb, toSheet(incomeWithTotal), 'Поступление за СМР');
    XLSX.writeFile(wb, 'Сводные_данные.xlsx');
  }, [smrWithTotal, incomeWithTotal, monthKeys]);

  if (rows.length === 0) return null;

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<DownloadOutlined />} onClick={exportToExcel}>
          Экспорт в Excel
        </Button>
      </div>
      <Typography.Title level={5} style={{ marginTop: 0 }}>Всего СМР по проектам</Typography.Title>
      <Table
        dataSource={smrWithTotal}
        columns={columns}
        pagination={false}
        bordered
        size="small"
        scroll={{ x: 'max-content' }}
        sticky
        className="bdds-summary-table"
        rowClassName={(record) => record.key === 'total_row' ? 'bdds-calculated-row' : ''}
      />

      <Typography.Title level={5} style={{ marginTop: 24 }}>Итого поступление за СМР по проектам</Typography.Title>
      <Table
        dataSource={incomeWithTotal}
        columns={columns}
        pagination={false}
        bordered
        size="small"
        scroll={{ x: 'max-content' }}
        sticky
        className="bdds-summary-table"
        rowClassName={(record) => record.key === 'total_row' ? 'bdds-calculated-row' : ''}
      />
    </>
  );
};
