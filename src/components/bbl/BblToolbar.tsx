import { useState, useEffect } from 'react';
import { Button, Space, Typography, Tag, Tooltip } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
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
  hasBalanceGap?: boolean;
}

export const BblToolbar = ({
  yearFrom, yearTo, onYearFromChange, onYearToChange,
  onSave, saving, selectedProjectId, onProjectChange,
  hasBalanceGap = false,
}: IProps) => {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    projectsService.getProjects().then((data) => {
      setProjects(data.filter((p) => p.is_active));
    });
  }, []);

  const saveDisabled = hasBalanceGap || saving;

  return (
    <div className="bdr-toolbar">
      <Space className="mb-8" wrap>
        <Typography.Text>с</Typography.Text>
        <YearSelect value={yearFrom} onChange={onYearFromChange} />
        <Typography.Text>по</Typography.Text>
        <YearSelect value={yearTo} onChange={onYearToChange} />
        {selectedProjectId && yearFrom === yearTo && (
          <Tooltip
            title={hasBalanceGap ? 'Сохранение заблокировано: баланс не сходится (разрыв ≠ 0)' : undefined}
          >
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={onSave}
              loading={saving}
              disabled={saveDisabled}
              danger={hasBalanceGap}
            >
              {hasBalanceGap ? 'Разрыв баланса' : 'Сохранить'}
            </Button>
          </Tooltip>
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
