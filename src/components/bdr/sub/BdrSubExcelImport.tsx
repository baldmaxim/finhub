import { useRef } from 'react';
import { Button, message, notification } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import type { BdrSubEntryFormData, BdrSubType } from '../../../types/bdr';
import { NDS_SUB_TYPES } from '../../../types/bdr';

interface IProps {
  subType: BdrSubType;
  projectId: string | null;
  selectedMonth: number | null;
  year: number;
  onImport: (data: BdrSubEntryFormData[]) => Promise<void>;
}

const COLUMN_ALIASES: Record<string, string[]> = {
  company: ['фирма', 'company', 'компания', 'организация', 'контрагент'],
  department: ['отдел/сотрудник', 'отдел', 'сотрудник', 'department', 'employee'],
  description: ['содержание', 'description', 'описание', 'наименование', 'назначение'],
  amount: ['сумма', 'amount', 'стоимость', 'итого', 'расходы с учетом офз'],
  amount_nds: ['сумма ндс', 'ндс', 'nds', 'vat'],
  amount_without_nds: ['сумма без ндс', 'без ндс', 'amount without nds', 'amount_without_nds'],
  ofz: ['офз за год', 'офз', 'ofz'],
  date: ['дата', 'date'],
  period: ['период', 'period', 'месяц'],
};

const normalizeKey = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase();

const findColumnValue = (row: Record<string, unknown>, aliases: string[]): unknown => {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const found = keys.find((k) => normalizeKey(k) === alias);
    if (found !== undefined) return row[found];
  }
  return undefined;
};

const parseAmount = (raw: unknown): number => {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    let cleaned = raw.replace(/\s/g, '');
    // "278,865.89" — запятая = разделитель тысяч, точка = десятичный
    if (cleaned.includes(',') && cleaned.includes('.')) {
      cleaned = cleaned.replace(/,/g, '');
    } else {
      // "1 234,56" — запятая = десятичный разделитель
      cleaned = cleaned.replace(',', '.');
    }
    const num = Number(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

const parseDate = (raw: unknown): string => {
  if (!raw) return '';
  if (raw instanceof Date) return raw.toISOString().split('T')[0];
  if (typeof raw === 'number') {
    const epoch = new Date((raw - 25569) * 86400 * 1000);
    if (!isNaN(epoch.getTime())) return epoch.toISOString().split('T')[0];
    return '';
  }
  if (typeof raw === 'string') {
    const dotParts = raw.split('.');
    if (dotParts.length === 3 && dotParts[0].length <= 2 && dotParts[1].length <= 2) {
      const y = dotParts[2].length === 2 ? `20${dotParts[2]}` : dotParts[2];
      return `${y}-${dotParts[1].padStart(2, '0')}-${dotParts[0].padStart(2, '0')}`;
    }
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return '';
};

interface IFailedRow {
  rowNum: number;
  reason: string;
}

const MONTH_NAME_MAP: Record<string, number> = {
  'январь': 1, 'февраль': 2, 'март': 3, 'апрель': 4,
  'май': 5, 'июнь': 6, 'июль': 7, 'август': 8,
  'сентябрь': 9, 'октябрь': 10, 'ноябрь': 11, 'декабрь': 12,
};

const MONTH_ABBR_MAP: Record<string, number> = {
  'янв': 1, 'фев': 2, 'мар': 3, 'апр': 4,
  'май': 5, 'июн': 6, 'июл': 7, 'авг': 8,
  'сен': 9, 'окт': 10, 'ноя': 11, 'дек': 12,
};

const parsePeriod = (raw: unknown): string => {
  if (!raw) return '';
  const str = String(raw).trim().toLowerCase();
  // Полные названия: "Апрель 2025"
  for (const [name, num] of Object.entries(MONTH_NAME_MAP)) {
    if (str.startsWith(name)) {
      const yearMatch = str.match(/\d{4}/);
      const y = yearMatch ? yearMatch[0] : String(new Date().getFullYear());
      return `${y}-${String(num).padStart(2, '0')}-01`;
    }
  }
  // Сокращённые: "апр.25", "апр 2025", "авг.25"
  for (const [abbr, num] of Object.entries(MONTH_ABBR_MAP)) {
    if (str.startsWith(abbr)) {
      const yearMatch = str.match(/(\d{2,4})/);
      if (yearMatch) {
        const y = yearMatch[1].length === 2 ? `20${yearMatch[1]}` : yearMatch[1];
        return `${y}-${String(num).padStart(2, '0')}-01`;
      }
      return `${new Date().getFullYear()}-${String(num).padStart(2, '0')}-01`;
    }
  }
  return parseDate(raw);
};

export const BdrSubExcelImport = ({ subType, projectId, selectedMonth, year, onImport }: IProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isOverheadLabor = subType === 'overhead_labor';
  const isFixedExpenses = subType === 'fixed_expenses';

  const getEntryDate = (): string => {
    const month = selectedMonth ?? new Date().getMonth() + 1;
    return `${year}-${String(month).padStart(2, '0')}-01`;
  };

  const allAliases = Object.values(COLUMN_ALIASES).flat();

  const hasKnownColumns = (row: Record<string, unknown>): boolean => {
    const keys = Object.keys(row).map(normalizeKey);
    return keys.some((k) => allAliases.includes(k));
  };

  const readSheetWithHeaderDetection = (sheet: XLSX.WorkSheet): Record<string, unknown>[] => {
    // Попытка 1: стандартное чтение (заголовки в 1й строке)
    const standard = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    if (standard.length > 0 && hasKnownColumns(standard[0])) {
      return standard;
    }

    // Попытка 2: сканируем первые 10 строк в поисках строки-заголовка
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
      const cells = rawRows[r];
      if (!Array.isArray(cells)) continue;
      const normalized = cells.map((c) => normalizeKey(String(c ?? '')));
      const matchCount = normalized.filter((n) => allAliases.includes(n)).length;
      if (matchCount >= 1) {
        // Нашли строку-заголовок — собираем данные из последующих строк
        const headers = cells.map((c) => String(c ?? '').trim());
        const result: Record<string, unknown>[] = [];
        for (let d = r + 1; d < rawRows.length; d++) {
          const dataRow = rawRows[d];
          if (!Array.isArray(dataRow) || dataRow.every((c) => c === null || c === undefined || c === '')) continue;
          const obj: Record<string, unknown> = {};
          for (let col = 0; col < headers.length; col++) {
            if (headers[col]) obj[headers[col]] = dataRow[col];
          }
          result.push(obj);
        }
        return result;
      }
    }

    // Попытка 3: позиционный парсинг (без заголовков)
    const positional: Record<string, unknown>[] = [];
    const startRow = standard.length > 0 ? 0 : 1;
    for (let r = startRow; r < rawRows.length; r++) {
      const cells = rawRows[r];
      if (!Array.isArray(cells) || cells.length < 2) continue;
      // Первая ячейка — период, средняя — ОФЗ за год, последняя — сумма
      const firstCell = cells[0];
      const lastCell = cells[cells.length - 1];
      if (!firstCell || !lastCell) continue;
      const obj: Record<string, unknown> = {
        'Период': firstCell,
        'Расходы с учетом ОФЗ': lastCell,
      };
      if (cells.length >= 3) {
        obj['ОФЗ за год'] = cells[1];
      }
      positional.push(obj);
    }
    return positional;
  };

  const handleFile = async (file: File) => {
    try {
      if (!projectId) {
        message.warning('Сначала выберите проект в фильтре сверху');
        return;
      }

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = readSheetWithHeaderDetection(sheet);

      if (jsonData.length === 0) {
        message.warning('Файл пуст или не содержит данных');
        return;
      }

      const entries: BdrSubEntryFormData[] = [];
      const failedRows: IFailedRow[] = [];

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNum = i + 2;

        const amount = parseAmount(findColumnValue(row, COLUMN_ALIASES.amount));

        if (!amount) {
          failedRows.push({ rowNum, reason: 'Сумма равна нулю или не распознана' });
          continue;
        }

        if (isFixedExpenses) {
          const periodRaw = findColumnValue(row, COLUMN_ALIASES.period) ?? findColumnValue(row, COLUMN_ALIASES.date);
          const entryDate = parsePeriod(periodRaw);
          if (!entryDate) {
            failedRows.push({ rowNum, reason: 'Не удалось распознать период' });
            continue;
          }
          // Сохраняем значение "ОФЗ за год" из Excel в поле description
          const ofzRaw = findColumnValue(row, COLUMN_ALIASES.ofz);
          const ofzValue = ofzRaw !== undefined ? String(ofzRaw).replace(/\s/g, '').replace(',', '.') : '';
          entries.push({
            sub_type: subType,
            project_id: projectId,
            entry_date: entryDate,
            company: '',
            description: ofzValue,
            amount,
          });
        } else if (isOverheadLabor) {
          const department = String(
            findColumnValue(row, COLUMN_ALIASES.department) ??
            findColumnValue(row, COLUMN_ALIASES.company) ?? ''
          );
          const entry: BdrSubEntryFormData = {
            sub_type: subType,
            project_id: projectId,
            entry_date: getEntryDate(),
            company: department,
            description: '',
            amount,
          };
          entry.amount_nds = parseAmount(findColumnValue(row, COLUMN_ALIASES.amount_nds));
          const parsedWithoutNds = parseAmount(findColumnValue(row, COLUMN_ALIASES.amount_without_nds));
          entry.amount_without_nds = parsedWithoutNds || amount;
          entries.push(entry);
        } else {
          const company = String(findColumnValue(row, COLUMN_ALIASES.company) ?? '');
          const description = String(findColumnValue(row, COLUMN_ALIASES.description) ?? '');
          const entryDate = parseDate(findColumnValue(row, COLUMN_ALIASES.date));

          if (!entryDate) {
            failedRows.push({ rowNum, reason: 'Не удалось распознать дату' });
            continue;
          }

          const entry: BdrSubEntryFormData = {
            sub_type: subType,
            project_id: projectId,
            entry_date: entryDate,
            company,
            description,
            amount,
          };

          if (NDS_SUB_TYPES.includes(subType)) {
            entry.amount_nds = parseAmount(findColumnValue(row, COLUMN_ALIASES.amount_nds));
            const parsedWoNds = parseAmount(findColumnValue(row, COLUMN_ALIASES.amount_without_nds));
            entry.amount_without_nds = parsedWoNds || amount;
          }

          entries.push(entry);
        }
      }

      if (entries.length === 0) {
        const cols = Object.keys(jsonData[0]).join(', ');
        const reasons = failedRows.slice(0, 3).map((f) => `Строка ${f.rowNum}: ${f.reason}`).join('; ');
        message.warning(`Не найдено записей. Колонки: ${cols}. ${reasons}`, 8);
        return;
      }

      await onImport(entries);

      if (failedRows.length > 0) {
        notification.warning({
          message: `Импортировано ${entries.length} из ${jsonData.length} строк`,
          description: (
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {failedRows.map((f) => (
                <li key={f.rowNum}>Строка {f.rowNum}: {f.reason}</li>
              ))}
            </ul>
          ),
          duration: 0,
        });
      } else {
        message.success(`Импортировано ${entries.length} записей`);
      }
    } catch (err) {
      console.error('Excel import error:', err);
      const msg = err instanceof Error
        ? err.message
        : (typeof err === 'object' && err !== null && 'message' in err)
          ? String((err as Record<string, unknown>).message)
          : JSON.stringify(err);
      message.error(`Ошибка импорта: ${msg}`);
    }

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <Button
        icon={<UploadOutlined />}
        onClick={() => inputRef.current?.click()}
      >
        Импорт Excel
      </Button>
    </>
  );
};
