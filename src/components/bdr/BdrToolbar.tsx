import { Button, Space, Typography } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { YearSelect } from '../common/YearSelect';
import { ProjectSelect } from '../common/ProjectSelect';

interface IProps {
  yearFrom: number;
  yearTo: number;
  onYearFromChange: (year: number) => void;
  onYearToChange: (year: number) => void;
  onSave: () => void;
  saving: boolean;
  selectedProjectId: string | null;
  onProjectChange: (projectId: string | null) => void;
}

export const BdrToolbar = ({
  yearFrom, yearTo, onYearFromChange, onYearToChange,
  onSave, saving, selectedProjectId, onProjectChange,
}: IProps) => {
  return (
    <Space className="mb-16" wrap>
      <ProjectSelect value={selectedProjectId} onChange={onProjectChange} />
      <Typography.Text>с</Typography.Text>
      <YearSelect value={yearFrom} onChange={onYearFromChange} />
      <Typography.Text>по</Typography.Text>
      <YearSelect value={yearTo} onChange={onYearToChange} />
      {selectedProjectId && yearFrom === yearTo && (
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={onSave}
          loading={saving}
        >
          Сохранить
        </Button>
      )}
    </Space>
  );
};
