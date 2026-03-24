import { useState, useCallback } from 'react';
import { Card, Alert, message } from 'antd';
import { useBdr } from '../../hooks/useBdr';
import { BdrToolbar } from './BdrToolbar';
import { BdrTable } from './BdrTable';
import { BdrSubModal } from './sub/BdrSubModal';
import { BdrFixedExpensesPlanModal } from './BdrFixedExpensesPlanModal';
import type { Project } from '../../types/projects';

const currentYear = new Date().getFullYear();

export const BdrPage = () => {
  const [yearFrom, setYearFrom] = useState(currentYear);
  const [yearTo, setYearTo] = useState(currentYear);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [fixedPlanModalOpen, setFixedPlanModalOpen] = useState(false);
  const {
    rows,
    yearRows,
    yearMonthSlots,
    loading,
    saving,
    error,
    overheadExpanded,
    costExpanded,
    toggleOverhead,
    toggleCost,
    updateEntry,
    saveAll,
    openSubType,
    setOpenSubType,
    reload,
  } = useBdr(yearFrom, yearTo, selectedProjectId);

  const isMultiYear = yearFrom !== yearTo;
  const isReadOnly = !selectedProjectId || isMultiYear;

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
    try {
      await saveAll();
      message.success('Данные сохранены');
    } catch {
      message.error('Ошибка сохранения');
    }
  };

  const handleSubClose = () => {
    setOpenSubType(null);
    reload();
  };

  if (error) {
    return <Alert type="error" message="Ошибка" description={error} showIcon />;
  }

  return (
    <>
      <Card title="БДР — Бюджет Доходов и Расходов" loading={loading}>
        <BdrToolbar
          yearFrom={yearFrom}
          yearTo={yearTo}
          onYearFromChange={handleYearFromChange}
          onYearToChange={handleYearToChange}
          onSave={handleSave}
          saving={saving}
          selectedProjectId={selectedProjectId}
          onProjectChange={handleProjectChange}
        />
        <BdrTable
          rows={rows}
          yearRows={yearRows}
          yearMonthSlots={yearMonthSlots}
          overheadExpanded={overheadExpanded}
          costExpanded={costExpanded}
          onToggleOverhead={toggleOverhead}
          onToggleCost={toggleCost}
          onUpdatePlan={isReadOnly ? undefined : (code, month, amount) => updateEntry(code, month, amount, 'plan')}
          onUpdateFact={isReadOnly ? undefined : (code, month, amount) => updateEntry(code, month, amount, 'fact')}
          onOpenSub={setOpenSubType}
          onOpenFixedPlan={() => setFixedPlanModalOpen(true)}
        />
      </Card>
      {openSubType && (
        <BdrSubModal
          subType={openSubType}
          year={yearFrom}
          yearTo={yearTo}
          initialProjectId={selectedProjectId}
          onClose={handleSubClose}
        />
      )}
      <BdrFixedExpensesPlanModal
        year={yearFrom}
        open={fixedPlanModalOpen}
        onClose={() => setFixedPlanModalOpen(false)}
        onSaved={reload}
      />
    </>
  );
};
