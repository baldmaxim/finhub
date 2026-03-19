import { Button, Select, Space, message } from 'antd';
import { PlusOutlined, DownloadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import type { BdrSubEntry, BdrSubType, BdrSubEntryFormData } from '../../../types/bdr';
import { NDS_SUB_TYPES } from '../../../types/bdr';
import type { Project } from '../../../types/projects';
import { BdrSubExcelImport } from './BdrSubExcelImport';
import { MONTHS } from '../../../utils/constants';

interface IProps {
  subType: BdrSubType;
  projects: Project[];
  entries: BdrSubEntry[];
  selectedProjectId: string | null;
  selectedMonth: number | null;
  year: number;
  onProjectChange: (id: string | null) => void;
  onMonthChange: (month: number | null) => void;
  onAdd: () => void;
  onImport: (data: BdrSubEntryFormData[]) => Promise<void>;
}

export const BdrSubToolbar = ({
  subType,
  projects,
  entries,
  selectedProjectId,
  selectedMonth,
  year,
  onProjectChange,
  onMonthChange,
  onAdd,
  onImport,
}: IProps) => {
  const isOverheadLabor = subType === 'overhead_labor';
  const isFixedExpenses = subType === 'fixed_expenses';
  const hasMonthFilter = isOverheadLabor || isFixedExpenses;

  const handleExport = () => {
    const exportData = isFixedExpenses
      ? entries.map((e) => ({
          'Период': new Date(e.entry_date).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
          'ОФЗ за год': e.description ? Number(e.description) : '',
          'Расходы с учетом ОФЗ': e.amount,
        }))
      : isOverheadLabor
      ? entries.map((e, i) => ({
          '№п/п': i + 1,
          'Отдел/Сотрудник': e.company,
          'Сумма': e.amount,
          'Сумма НДС': e.amount_nds || 0,
          'Сумма без НДС': e.amount_without_nds || 0,
        }))
      : NDS_SUB_TYPES.includes(subType)
      ? entries.map((e, i) => ({
          '№п/п': i + 1,
          'Фирма': e.company,
          'Дата': new Date(e.entry_date).toLocaleDateString('ru-RU'),
          'Содержание': e.description,
          'Сумма': e.amount,
          'Сумма НДС': e.amount_nds || 0,
          'Сумма без НДС': e.amount_without_nds || 0,
        }))
      : entries.map((e, i) => ({
          '№п/п': i + 1,
          'Фирма': e.company,
          'Дата': new Date(e.entry_date).toLocaleDateString('ru-RU'),
          'Содержание': e.description,
          'Сумма': e.amount,
        }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Данные');
    const monthSuffix = hasMonthFilter && selectedMonth
      ? `_${String(selectedMonth).padStart(2, '0')}`
      : '';
    XLSX.writeFile(wb, `export_${subType}${monthSuffix}_${year}.xlsx`);
  };

  return (
    <Space className="mb-16" wrap>
      {hasMonthFilter && (
        <Select
          value={selectedMonth}
          onChange={onMonthChange}
          className="select-month"
          allowClear
          placeholder="Все месяцы"
        >
          {MONTHS.map((m) => (
            <Select.Option key={m.key} value={m.key}>
              {m.full}
            </Select.Option>
          ))}
        </Select>
      )}
      <Select
        value={selectedProjectId}
        onChange={onProjectChange}
        className="select-project-wide"
        allowClear
        placeholder="Все проекты"
      >
        {projects.map((p) => (
          <Select.Option key={p.id} value={p.id}>
            {p.name}
          </Select.Option>
        ))}
      </Select>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => {
          if (!selectedProjectId) {
            message.warning('Выберите проект перед добавлением');
            return;
          }
          onAdd();
        }}
      >
        Добавить
      </Button>
      <BdrSubExcelImport
        subType={subType}
        projectId={selectedProjectId}
        selectedMonth={selectedMonth}
        year={year}
        onImport={onImport}
      />
      <Button icon={<DownloadOutlined />} onClick={handleExport}>
        Экспорт Excel
      </Button>
    </Space>
  );
};
