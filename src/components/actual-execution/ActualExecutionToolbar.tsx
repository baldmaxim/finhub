import { useRef } from 'react';
import { Space, Select, Button, message } from 'antd';
import { UploadOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import type { Project } from '../../types/projects';
import type { ActualExecutionEntry } from '../../types/actualExecution';
import { MONTHS } from '../../utils/constants';

interface IProps {
  projects: Project[];
  selectedProjectId: string | null;
  onProjectChange: (id: string | null) => void;
  onImport: (data: Array<{ monthKey: string; ksAmount: number; factAmount: number }>) => void;
  onAdd: () => void;
  entries: ActualExecutionEntry[];
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

function parsePeriod(value: string): string | null {
  const trimmed = String(value).trim();

  // ISO: "2026-01"
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;

  // Dot: "01.2026"
  const dotMatch = trimmed.match(/^(\d{2})\.(\d{4})$/);
  if (dotMatch) return `${dotMatch[2]}-${dotMatch[1]}`;

  // Full date: "01.01.2026" or "2026-01-15" — extract month
  const fullDotMatch = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (fullDotMatch) return `${fullDotMatch[3]}-${fullDotMatch[2]}`;

  const fullIsoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (fullIsoMatch) return `${fullIsoMatch[1]}-${fullIsoMatch[2]}`;

  // Text: "Январь 2026", "Янв 2026"
  const textMatch = trimmed.toLowerCase().match(/^(\S+)\s+(\d{4})$/);
  if (textMatch) {
    const monthNum = MONTH_NAMES[textMatch[1]];
    if (monthNum) return `${textMatch[2]}-${monthNum}`;
  }

  // Just month name without year — skip
  return null;
}

function parseNumber(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0;
  const num = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

export const ActualExecutionToolbar = ({
  projects,
  selectedProjectId,
  onProjectChange,
  onImport,
  onAdd,
  entries,
}: IProps) => {
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
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

        if (jsonData.length === 0) {
          message.error('Файл пуст');
          return;
        }

        const result: Array<{ monthKey: string; ksAmount: number; factAmount: number }> = [];

        for (const row of jsonData) {
          // Ищем столбец "Период"
          const periodValue = row['Период'] ?? row['период'] ?? row['Period'];
          if (!periodValue) continue;

          const monthKey = parsePeriod(String(periodValue));
          if (!monthKey) continue;

          // Ищем столбцы с данными
          const ksAmount = parseNumber(
            row['Выполнено по КС (подписано)'] ??
            row['выполнено по кс (подписано)'] ??
            row['КС'] ??
            row['кс'] ??
            0
          );

          const factAmount = parseNumber(
            row['Выполнение фактическое'] ??
            row['выполнение фактическое'] ??
            row['Факт'] ??
            row['факт'] ??
            0
          );

          result.push({ monthKey, ksAmount, factAmount });
        }

        if (result.length === 0) {
          message.error('Не удалось распознать данные. Проверьте столбцы: "Период", "Выполнено по КС (подписано)", "Выполнение фактическое"');
          return;
        }

        onImport(result);
        message.success(`Импортировано: ${result.length} записей`);
      } catch {
        message.error('Ошибка чтения файла Excel');
      }
    };

    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExport = () => {
    if (entries.length === 0) {
      message.warning('Нет данных для экспорта');
      return;
    }

    const projectMap = new Map(projects.map((p) => [p.id, p.name]));

    const exportData = entries.map((entry, idx) => ({
      '№п/п': idx + 1,
      'Проект': projectMap.get(entry.project_id) || '',
      'Период': formatMonthKey(entry.month_key),
      'Выполнено по КС (подписано)': Number(entry.ks_amount),
      'Выполнение фактическое': Number(entry.fact_amount),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Фактическое выполнение');
    XLSX.writeFile(wb, 'factual_execution.xlsx');
    message.success('Файл экспортирован');
  };

  return (
    <Space wrap className="mb-16">
      <Select
        placeholder="Все проекты"
        value={selectedProjectId}
        onChange={onProjectChange}
        allowClear
        className="select-project-wide"
        options={projects.map((p) => ({ value: p.id, label: p.name }))}
      />
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
        disabled={!selectedProjectId}
      >
        Импорт
      </Button>
      <Button icon={<DownloadOutlined />} onClick={handleExport}>
        Экспорт
      </Button>
      <Button icon={<PlusOutlined />} onClick={onAdd} disabled={!selectedProjectId}>
        Добавить
      </Button>
    </Space>
  );
};

function formatMonthKey(monthKey: string): string {
  const [year, monthStr] = monthKey.split('-');
  const month = parseInt(monthStr, 10);
  const m = MONTHS.find((m) => m.key === month);
  return m ? `${m.full} ${year}` : monthKey;
}
