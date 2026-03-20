import { Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import type { BddsReceiptDetail } from '../../../types/bddsReceipt';

interface IProps {
  rows: BddsReceiptDetail[];
  disabled: boolean;
  projectName?: string;
  year: number;
}

export const ReceiptExcelExport = ({ rows, disabled, projectName, year }: IProps) => {
  const handleExport = () => {
    const data = rows.map((r, idx) => ({
      '№ п/п': r.row_number ?? idx + 1,
      'Дата': r.receipt_date ?? '',
      'Заказчик': r.customer,
      'Договор': r.contract,
      'Проект': r.project_name,
      'Сумма': r.amount,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Поступления');

    const fileName = `Поступления_${projectName ?? 'все'}_${year}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <Button
      icon={<DownloadOutlined />}
      onClick={handleExport}
      disabled={disabled || rows.length === 0}
    >
      Экспорт в Excel
    </Button>
  );
};
