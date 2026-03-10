import { Select, Space, Typography } from 'antd';
import { YearSelect } from '../../common/YearSelect';
import type { Project } from '../../../types/projects';
import type { ExcelImportData } from '../../../types/bddsIncome';
import { ExcelImportButton } from './ExcelImportButton';

interface IProps {
  projects: Project[];
  selectedProjectId: string | null;
  onProjectChange: (id: string | null) => void;
  yearFrom: number;
  yearTo: number;
  onYearFromChange: (year: number) => void;
  onYearToChange: (year: number) => void;
  onImport: (data: ExcelImportData[]) => void;
}

export const BddsIncomeToolbar = ({
  projects,
  selectedProjectId,
  onProjectChange,
  yearFrom,
  yearTo,
  onYearFromChange,
  onYearToChange,
  onImport,
}: IProps) => {
  const options = [
    { value: '__all__', label: 'Все проекты' },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <Space className="mb-16" wrap>
      <Select
        value={selectedProjectId ?? '__all__'}
        onChange={(val) => onProjectChange(val === '__all__' ? null : val)}
        options={options}
        className="select-project"
        placeholder="Выберите проект"
      />
      <Typography.Text>с</Typography.Text>
      <YearSelect value={yearFrom} onChange={onYearFromChange} />
      <Typography.Text>по</Typography.Text>
      <YearSelect value={yearTo} onChange={onYearToChange} />
      <ExcelImportButton
        disabled={!selectedProjectId}
        onImport={onImport}
      />
    </Space>
  );
};
