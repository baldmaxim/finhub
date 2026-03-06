import { useRef } from 'react';
import { Button, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { findWorkTypeByName } from '../../../utils/workTypes';
import type { ExcelImportData } from '../../../types/bddsIncome';

interface IProps {
  disabled: boolean;
  onImport: (data: ExcelImportData[]) => void;
}

function parseMonthHeader(header: string): string | null {
  const trimmed = header.trim();

  // Формат: "Янв 2026", "Февраль 2026", "01.2026", "2026-01"
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;

  const dotMatch = trimmed.match(/^(\d{2})\.(\d{4})$/);
  if (dotMatch) return `${dotMatch[2]}-${dotMatch[1]}`;

  const monthNames: Record<string, string> = {
    'январь': '01', 'янв': '01', 'jan': '01',
    'февраль': '02', 'фев': '02', 'feb': '02',
    'март': '03', 'мар': '03', 'mar': '03',
    'апрель': '04', 'апр': '04', 'apr': '04',
    'май': '05', 'may': '05',
    'июнь': '06', 'июн': '06', 'jun': '06',
    'июль': '07', 'июл': '07', 'jul': '07',
    'август': '08', 'авг': '08', 'aug': '08',
    'сентябрь': '09', 'сен': '09', 'sep': '09',
    'октябрь': '10', 'окт': '10', 'oct': '10',
    'ноябрь': '11', 'ноя': '11', 'nov': '11',
    'декабрь': '12', 'дек': '12', 'dec': '12',
  };

  const textMatch = trimmed.toLowerCase().match(/^(\S+)\s+(\d{4})$/);
  if (textMatch) {
    const monthNum = monthNames[textMatch[1]];
    if (monthNum) return `${textMatch[2]}-${monthNum}`;
  }

  return null;
}

export const ExcelImportButton = ({ disabled, onImport }: IProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

        if (jsonData.length < 2) {
          message.error('Файл пуст или содержит только заголовки');
          return;
        }

        const headers = jsonData[0];
        // Первый столбец — наименование, второй — примечание, далее — месяцы
        const monthColumns: Array<{ index: number; key: string }> = [];

        for (let i = 2; i < headers.length; i++) {
          const mk = parseMonthHeader(String(headers[i] || ''));
          if (mk) {
            monthColumns.push({ index: i, key: mk });
          }
        }

        if (monthColumns.length === 0) {
          message.error('Не удалось определить столбцы с месяцами. Используйте формат: "Янв 2026" или "2026-01"');
          return;
        }

        const result: ExcelImportData[] = [];
        const skippedNames: string[] = [];

        for (let r = 1; r < jsonData.length; r++) {
          const row = jsonData[r];
          if (!row) continue;

          // Ищем имя вида работ в первых трёх столбцах (col 0, 1, 2)
          // В Excel могут быть объединённые ячейки, из-за чего имя попадает в другой столбец
          let workType;
          let noteColIndex = 1;

          for (let col = 0; col <= 2; col++) {
            if (row[col]) {
              workType = findWorkTypeByName(String(row[col]).trim());
              if (workType) {
                noteColIndex = col + 1;
                break;
              }
            }
          }

          if (!workType) {
            const name = String(row[0] || row[1] || row[2] || '').trim();
            if (name) skippedNames.push(name);
            continue;
          }

          const note = row[noteColIndex] ? String(row[noteColIndex]).trim() : '';
          const months: Record<string, number> = {};

          for (const mc of monthColumns) {
            const val = row[mc.index];
            const num = val !== undefined && val !== null && val !== ''
              ? Number(String(val).replace(/\s/g, '').replace(',', '.'))
              : 0;
            months[mc.key] = isNaN(num) ? 0 : num;
          }

          result.push({
            workTypeCode: workType.code,
            note,
            months,
          });
        }

        if (result.length === 0) {
          message.error('Не найдено совпадений по наименованиям работ');
          return;
        }

        if (skippedNames.length > 0) {
          message.warning(`Пропущено строк (${skippedNames.length}): ${skippedNames.join(', ')}`, 10);
        }

        // Диагностика: показать данные по Возврат ГУ
        const guRow = result.find((r) => r.workTypeCode === 'guarantee_return');
        if (guRow) {
          const nonZero = Object.entries(guRow.months).filter(([, v]) => v !== 0);
          console.log('[Import] Возврат ГУ найдена, ненулевые месяцы:', nonZero);
          console.log('[Import] Все месяцы Возврат ГУ:', guRow.months);
          if (nonZero.length === 0) {
            message.info('Возврат ГУ: все значения = 0. Проверьте столбцы в Excel.', 10);
          } else {
            message.info(`Возврат ГУ: ${nonZero.length} ненулевых месяцев: ${nonZero.map(([k, v]) => `${k}=${v}`).join(', ')}`, 10);
          }
        } else {
          console.log('[Import] Возврат ГУ НЕ найдена в результатах');
        }

        // Диагностика: показать распознанные месяцы
        console.log('[Import] Распознанные месяцы:', monthColumns.map((mc) => `col${mc.index}=${mc.key}`));

        onImport(result);
        message.success(`Импортировано: ${result.length} строк, ${monthColumns.length} месяцев`);
      } catch {
        message.error('Ошибка чтения файла Excel');
      }
    };

    reader.readAsArrayBuffer(file);
    // Сбросить input чтобы можно было загрузить тот же файл повторно
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
}
