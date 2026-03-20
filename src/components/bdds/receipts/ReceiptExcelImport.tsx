import { useRef } from 'react';
import { Button, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import type { BddsReceiptImportRow } from '../../../types/bddsReceipt';

interface IProps {
  disabled: boolean;
  onImport: (data: BddsReceiptImportRow[]) => void;
}

function parseDate(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  // dd.mm.yyyy
  const dmy = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmy) {
    const d = parseInt(dmy[1], 10);
    const m = parseInt(dmy[2], 10);
    const y = parseInt(dmy[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  // yyyy-mm-dd
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return str;
  return null;
}

function parseAmount(val: unknown): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const num = Number(String(val).replace(/\s/g, '').replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

export const ReceiptExcelImport = ({ disabled, onImport }: IProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

        if (jsonData.length < 2) {
          message.error('Файл пуст или содержит только заголовки');
          return;
        }

        // Ищем строку заголовков — первую строку содержащую "дата" или "заказчик"
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(10, jsonData.length); i++) {
          const row = jsonData[i] as unknown[];
          if (!row) continue;
          const joined = row.map((c) => String(c ?? '').toLowerCase()).join(' ');
          if (joined.includes('дата') || joined.includes('заказчик') || joined.includes('договор')) {
            headerRowIdx = i;
            break;
          }
        }

        // Определяем колонки: № п/п, Дата, Заказчик, Договор, Проект, Сумма
        const headerRow = (jsonData[headerRowIdx] as unknown[]) || [];
        const colMap: Record<string, number> = {};
        const aliases: Record<string, string[]> = {
          row_number: ['№', '№ п/п', 'номер', 'n', '#'],
          receipt_date: ['дата'],
          customer: ['заказчик', 'контрагент', 'клиент'],
          contract: ['договор', 'контракт'],
          project_name: ['проект', 'объект'],
          amount: ['сумма', 'amount', 'итого'],
        };

        for (let c = 0; c < headerRow.length; c++) {
          const hdr = String(headerRow[c] ?? '').trim().toLowerCase();
          if (!hdr) continue;
          for (const [field, names] of Object.entries(aliases)) {
            if (!colMap[field] && names.some((n) => hdr.includes(n))) {
              colMap[field] = c;
            }
          }
        }

        if (colMap.amount === undefined) {
          message.error('Не найден столбец "Сумма" в заголовках');
          return;
        }

        const result: BddsReceiptImportRow[] = [];
        for (let r = headerRowIdx + 1; r < jsonData.length; r++) {
          const row = jsonData[r] as unknown[];
          if (!row) continue;

          const amount = parseAmount(row[colMap.amount]);
          if (amount === 0) continue;

          result.push({
            row_number: colMap.row_number !== undefined ? Number(row[colMap.row_number]) || null : r - headerRowIdx,
            receipt_date: colMap.receipt_date !== undefined ? parseDate(row[colMap.receipt_date]) : null,
            customer: colMap.customer !== undefined ? String(row[colMap.customer] ?? '').trim() : '',
            contract: colMap.contract !== undefined ? String(row[colMap.contract] ?? '').trim() : '',
            project_name: colMap.project_name !== undefined ? String(row[colMap.project_name] ?? '').trim() : '',
            amount,
          });
        }

        if (result.length === 0) {
          message.error('Не найдено строк с суммами');
          return;
        }

        onImport(result);
        message.success(`Импортировано ${result.length} строк`);
      } catch {
        message.error('Ошибка чтения файла Excel');
      }
    };

    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden-input"
        onChange={handleFileChange}
      />
      <Button
        icon={<UploadOutlined />}
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
      >
        Импорт из Excel
      </Button>
    </>
  );
};
