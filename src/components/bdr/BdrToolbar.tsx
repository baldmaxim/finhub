import { useState, useEffect } from 'react';
import { Button, Space, Typography, Tag, Switch } from 'antd';
import { SaveOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { YearSelect } from '../common/YearSelect';
import type { Project } from '../../types/projects';
import * as projectsService from '../../services/projectsService';

interface IProps {
  yearFrom: number;
  yearTo: number;
  onYearFromChange: (year: number) => void;
  onYearToChange: (year: number) => void;
  onSave: () => void;
  saving: boolean;
  selectedProjectId: string | null;
  onProjectChange: (projectId: string | null, project: Project | null) => void;
  hideEmpty: boolean;
  onHideEmptyChange: (value: boolean) => void;
}

export const BdrToolbar = ({
  yearFrom, yearTo, onYearFromChange, onYearToChange,
  onSave, saving, selectedProjectId, onProjectChange,
  hideEmpty, onHideEmptyChange,
}: IProps) => {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    projectsService.getProjects().then((data) => {
      setProjects(data.filter((p) => p.is_active));
    });
  }, []);

  return (
    <div className="bdr-toolbar">
      <Space className="mb-8" wrap>
        <Typography.Text>с</Typography.Text>
        <YearSelect value={yearFrom} onChange={onYearFromChange} />
        <Typography.Text>по</Typography.Text>
        <YearSelect value={yearTo} onChange={onYearToChange} />
        <Space>
          <EyeInvisibleOutlined />
          <Switch
            size="small"
            checked={hideEmpty}
            onChange={onHideEmptyChange}
          />
          <Typography.Text type="secondary">Скрыть пустые</Typography.Text>
        </Space>
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
      <div className="dashboard-project-tags">
        <Tag.CheckableTag
          checked={selectedProjectId === null}
          onChange={() => onProjectChange(null, null)}
        >
          Все проекты
        </Tag.CheckableTag>
        {projects.map((p) => (
          <Tag.CheckableTag
            key={p.id}
            checked={selectedProjectId === p.id}
            onChange={(checked) => onProjectChange(checked ? p.id : null, checked ? p : null)}
          >
            {p.name}
          </Tag.CheckableTag>
        ))}
      </div>
    </div>
  );
};
