import { useState, useCallback } from 'react';
import { Card, Tabs, Alert } from 'antd';
import { useDashboard } from '../../hooks/useDashboard';
import { useBdrBubbleData } from '../../hooks/useBdrBubbleData';
import { useBdrExecutionVsKs } from '../../hooks/useBdrExecutionVsKs';
import { DashboardToolbar } from './DashboardToolbar';
import { BdrDashboard } from './bdr/BdrDashboard';
import { BdrDashboard2 } from './bdr2/BdrDashboard2';
import { BddsDashboard } from './bdds/BddsDashboard';
import { BddsDashboard2 } from './bdds2/BddsDashboard2';
import type { Project } from '../../types/projects';

const currentYear = new Date().getFullYear();

export const DashboardPage = () => {
  const [yearFrom, setYearFrom] = useState(currentYear);
  const [yearTo, setYearTo] = useState(currentYear);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [startMonth, setStartMonth] = useState<number | null>(null);

  const handleYearFromChange = useCallback((y: number) => {
    setYearFrom(y);
    if (y > yearTo) setYearTo(y);
  }, [yearTo]);

  const handleYearToChange = useCallback((y: number) => {
    setYearTo(y);
    if (y < yearFrom) setYearFrom(y);
  }, [yearFrom]);

  const handleProjectChange = useCallback((projectId: string | null, project: Project | null) => {
    setSelectedProjectId(projectId);
    if (project?.start_date) {
      const d = new Date(project.start_date);
      setYearFrom(d.getFullYear());
      setStartMonth(d.getMonth() + 1);
    } else if (!projectId) {
      setYearFrom(currentYear);
      setStartMonth(null);
    }
    setYearTo(currentYear);
  }, []);

  const { bdrData, bddsData, materialsDelta, loading, error } = useDashboard(yearFrom, yearTo, selectedProjectId, startMonth);
  const { data: bubbleData, loading: bubbleLoading, error: bubbleError } = useBdrBubbleData(yearFrom, yearTo);
  const { data: execVsKsData, loading: execVsKsLoading, error: execVsKsError } = useBdrExecutionVsKs(yearFrom, yearTo, selectedProjectId);

  if (error || bubbleError || execVsKsError) {
    return <Alert type="error" message="Ошибка" description={error || bubbleError || execVsKsError} showIcon />;
  }

  const items = [
    {
      key: 'bdr',
      label: 'БДР',
      children: <BdrDashboard data={bdrData} loading={loading} />,
    },
    {
      key: 'bdr2',
      label: 'БДР #2',
      children: <BdrDashboard2 bubbleData={bubbleData} executionVsKsData={execVsKsData} materialsDelta={materialsDelta} loading={bubbleLoading || execVsKsLoading || loading} />,
    },
    {
      key: 'bdds',
      label: 'БДДС',
      children: <BddsDashboard data={bddsData} loading={loading} />,
    },
    {
      key: 'bdds2',
      label: 'БДДС #2',
      children: <BddsDashboard2 data={bddsData} loading={loading} />,
    },
  ];

  return (
    <Card title="Дашборды">
      <DashboardToolbar
        yearFrom={yearFrom}
        yearTo={yearTo}
        onYearFromChange={handleYearFromChange}
        onYearToChange={handleYearToChange}
        selectedProjectId={selectedProjectId}
        onProjectChange={handleProjectChange}
      />
      <Tabs items={items} defaultActiveKey="bdr" />
    </Card>
  );
};
