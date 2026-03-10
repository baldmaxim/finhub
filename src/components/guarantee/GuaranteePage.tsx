import { Card, Spin, Alert, Segmented } from 'antd';
import { TableOutlined, BarChartOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useGuarantee } from '../../hooks/useGuarantee';
import { GuaranteeToolbar } from './GuaranteeToolbar';
import { GuaranteeTable } from './GuaranteeTable';
import { GuaranteeChart } from './GuaranteeChart';

type ViewMode = 'table' | 'chart';

export const GuaranteePage = () => {
  const {
    rows,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    yearFrom,
    yearTo,
    setYearFrom,
    setYearTo,
    statusFilter,
    setStatusFilter,
    loading,
    error,
    saveFact,
    deleteFact,
  } = useGuarantee();

  const [viewMode, setViewMode] = useState<ViewMode>('table');

  if (error) {
    return <Alert type="error" message="Ошибка" description={error} showIcon />;
  }

  return (
    <Card
      title="Контроль сроков возврата ГУ"
      extra={
        <Segmented
          value={viewMode}
          onChange={(v) => setViewMode(v as ViewMode)}
          options={[
            { value: 'table', icon: <TableOutlined /> },
            { value: 'chart', icon: <BarChartOutlined /> },
          ]}
        />
      }
    >
      <GuaranteeToolbar
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
        yearFrom={yearFrom}
        yearTo={yearTo}
        onYearFromChange={setYearFrom}
        onYearToChange={setYearTo}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
      />
      {loading ? (
        <div className="page-center">
          <Spin size="large" />
        </div>
      ) : viewMode === 'table' ? (
        <GuaranteeTable
          rows={rows}
          onSaveFact={saveFact}
          onDeleteFact={deleteFact}
        />
      ) : (
        <GuaranteeChart rows={rows} selectedYear={yearFrom} />
      )}
    </Card>
  );
};
