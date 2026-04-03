import { useState, useCallback } from 'react';
import { Card, Alert, message } from 'antd';
import { useBbl } from '../../hooks/useBbl';
import { BblToolbar } from './BblToolbar';
import { BblHealthCards } from './BblHealthCards';
import { BblTable } from './BblTable';
import type { Project } from '../../types/projects';

const currentYear = new Date().getFullYear();

export const BblPage = () => {
  const [yearFrom, setYearFrom] = useState(currentYear);
  const [yearTo, setYearTo] = useState(currentYear);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const {
    rows,
    yearRows,
    yearMonthSlots,
    loading,
    saving,
    error,
    updateEntry,
    saveAll,
    healthMetrics,
  } = useBbl(yearFrom, yearTo, selectedProjectId);

  const isMultiYear = yearFrom !== yearTo;
  const isReadOnly = !selectedProjectId || isMultiYear;
  const hasGap = Math.abs(healthMetrics.balanceGap) > 0.01;

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
      setYearFrom(new Date(project.start_date).getFullYear());
    } else if (!projectId) {
      setYearFrom(currentYear);
    }
    if (project?.gu_return_date) {
      setYearTo(new Date(project.gu_return_date).getFullYear());
    } else if (!projectId) {
      setYearTo(currentYear);
    }
  }, []);

  const handleSave = async () => {
    if (hasGap) {
      message.error('Сохранение заблокировано: баланс не сходится');
      return;
    }
    try {
      await saveAll();
      message.success('Данные сохранены');
    } catch {
      message.error('Ошибка сохранения');
    }
  };

  if (error) {
    return <Alert type="error" message="Ошибка" description={error} showIcon />;
  }

  return (
    <>
      <BblHealthCards metrics={healthMetrics} />
      <Card title="ББЛ — Управленческий баланс" loading={loading} className="mt-16">
        <BblToolbar
          yearFrom={yearFrom}
          yearTo={yearTo}
          onYearFromChange={handleYearFromChange}
          onYearToChange={handleYearToChange}
          onSave={handleSave}
          saving={saving}
          selectedProjectId={selectedProjectId}
          onProjectChange={handleProjectChange}
          hasBalanceGap={hasGap}
        />
        {hasGap && (
          <Alert
            type="error"
            message="Баланс не сходится — сохранение заблокировано"
            description={`Разрыв: ИТОГО АКТИВЫ − ИТОГО ПАССИВЫ = ${(healthMetrics.balanceGap / 1_000_000).toFixed(2)} млн. Утверждение факта невозможно до устранения расхождения.`}
            showIcon
            className="mb-16"
          />
        )}
        <BblTable
          rows={rows}
          yearRows={yearRows}
          yearMonthSlots={yearMonthSlots}
          onUpdatePlan={isReadOnly ? undefined : (code, month, amount) => updateEntry(code, month, amount, 'plan')}
          onUpdateFact={isReadOnly ? undefined : (code, month, amount) => updateEntry(code, month, amount, 'fact')}
        />
      </Card>
    </>
  );
};
