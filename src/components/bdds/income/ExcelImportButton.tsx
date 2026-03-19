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

const MONTH_NAMES: Record<string, string> = {
  'январь': '01', 'янв': '01', 'jan': '01', 'january': '01',
  'февраль': '02', 'фев': '02', 'feb': '02', 'february': '02',
  'март': '03', 'мар': '03', 'mar': '03', 'march': '03',
  'апрель': '04', 'апр': '04', 'apr': '04', 'april': '04',
  'май': '05', 'may': '05',
  'июнь': '06', 'июн': '06', 'jun': '06', 'june': '06',
  'июль': '07', 'июл': '07', 'jul': '07', 'july': '07',
  'август': '08', 'авг': '08', 'aug': '08', 'august': '08',
  'сентябрь': '09', 'сен': '09', 'sep': '09', 'september': '09',
  'октябрь': '10', 'окт': '10', 'oct': '10', 'october': '10',
  'ноябрь': '11', 'ноя': '11', 'nov': '11', 'november': '11',
  'декабрь': '12', 'дек': '12', 'dec': '12', 'december': '12',
};

function dateToMonthKey(d: Date): string | null {
  const y = d.getFullYear();
  if (y < 2000 || y > 2100) return null;
  return `${y}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonthHeader(header: unknown): string | null {
  // Date-объект (cellDates: true)
  if (header instanceof Date) return dateToMonthKey(header);

  // Excel serial date (число)
  if (typeof header === 'number' && header > 30000 && header < 70000) {
    const d = new Date((header - 25569) * 86400000);
    return dateToMonthKey(d);
  }

  const trimmed = String(header ?? '').trim();
  if (!trimmed) return null;

  // "2026-01"
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;

  // "01.2026", "1.2028"
  const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{4})$/);
  if (dotMatch) return `${dotMatch[2]}-${dotMatch[1].padStart(2, '0')}`;

  // "Янв 2026", "Январь 2026", "Янв. 2026", "янв.2026"
  const textMatch = trimmed.toLowerCase().match(/^([a-zа-яё]+)\.?\s*(\d{4})$/);
  if (textMatch) {
    const monthNum = MONTH_NAMES[textMatch[1]];
    if (monthNum) return `${textMatch[2]}-${monthNum}`;
  }

  // "авг.22", "сен.22", "янв 23", "мар.25" — сокращённый месяц + 2-значный год
  const shortYearMatch = trimmed.toLowerCase().match(/^([a-zа-яё]+)\.?\s*(\d{2})$/);
  if (shortYearMatch) {
    const monthNum = MONTH_NAMES[shortYearMatch[1]];
    if (monthNum) {
      const year = 2000 + parseInt(shortYearMatch[2], 10);
      return `${year}-${monthNum}`;
    }
  }

  return null;
}

/** Получить форматированное значение ячейки заголовка */
function getHeaderCellValue(sheet: XLSX.WorkSheet, row: number, col: number): unknown {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = sheet[addr];
  if (!cell) return undefined;

  // Приоритет: форматированное значение (w) > raw значение (v)
  // w содержит текст как он отображается в Excel (напр. "Янв 2028")
  if (cell.w) return cell.w;

  // Для дат — конвертировать в Date
  if (cell.t === 'd' && cell.v instanceof Date) return cell.v;

  // Для чисел с форматом даты — конвертировать
  if (cell.t === 'n' && typeof cell.v === 'number') return cell.v;

  return cell.v;
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
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

        if (jsonData.length < 2) {
          message.error('Файл пуст или содержит только заголовки');
          return;
        }

        // Ищем строку с месяцами среди первых 10 строк
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
        let headerRow = -1;
        let monthColumns: Array<{ index: number; key: string }> = [];
        const skippedHeaders: string[] = [];

        for (let r = range.s.r; r <= Math.min(range.s.r + 9, range.e.r); r++) {
          const cols: Array<{ index: number; key: string }> = [];
          for (let c = 0; c <= range.e.c; c++) {
            const cellValue = getHeaderCellValue(sheet, r, c);
            const mk = parseMonthHeader(cellValue);
            if (mk) cols.push({ index: c, key: mk });
          }
          if (cols.length >= 3) {
            headerRow = r;
            monthColumns = cols;
            break;
          }
        }

        if (headerRow === -1 || monthColumns.length === 0) {
          message.error('Не удалось определить столбцы с месяцами. Используйте формат: "Янв 2026" или "2026-01"');
          return;
        }

        // Собрать нераспознанные заголовки из найденной строки
        for (let c = 0; c <= range.e.c; c++) {
          const cellValue = getHeaderCellValue(sheet, headerRow, c);
          if (cellValue !== undefined && cellValue !== null) {
            const str = String(cellValue).trim();
            const mk = parseMonthHeader(cellValue);
            if (!mk && str && str.toLowerCase() !== 'итого') {
              skippedHeaders.push(str);
            }
          }
        }

        // Диагностика
        console.log('[Импорт] Все распознанные месяцы:', monthColumns.map(m => m.key));
        if (skippedHeaders.length > 0) {
          console.warn('[Импорт] Нераспознанные заголовки:', skippedHeaders);
          message.warning(`Нераспознанные столбцы (${skippedHeaders.length}): ${skippedHeaders.slice(0, 5).join(', ')}`, 10);
        }

        // Убираем дубликаты месяцев — оставляем только первое вхождение
        const seenKeys = new Set<string>();
        const uniqueMonthColumns = monthColumns.filter((mc) => {
          if (seenKeys.has(mc.key)) return false;
          seenKeys.add(mc.key);
          return true;
        });

        const result: ExcelImportData[] = [];
        const skippedNames: string[] = [];

        // Строки данных начинаются после строки заголовков
        const dataStartRow = headerRow - range.s.r + 1;
        for (let r = dataStartRow; r < jsonData.length; r++) {
          const row = jsonData[r] as unknown[];
          if (!row) continue;

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

          for (const mc of uniqueMonthColumns) {
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

        const firstMonth = uniqueMonthColumns[0].key;
        const lastMonth = uniqueMonthColumns[uniqueMonthColumns.length - 1].key;

        onImport(result);
        message.success(
          `Импортировано: ${result.length} строк, ${uniqueMonthColumns.length} месяцев (${firstMonth} — ${lastMonth})`,
          10
        );
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
}
