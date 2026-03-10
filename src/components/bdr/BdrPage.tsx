import { useState, useCallback } from 'react';
import { Card, Alert, message } from 'antd';
import { useBdr } from '../../hooks/useBdr';
import { BdrToolbar } from './BdrToolbar';
import { BdrTable } from './BdrTable';
import { BdrSubModal } from './sub/BdrSubModal';

const currentYear = new Date().getFullYear();

export const BdrPage = () => {
  const [yearFrom, setYearFrom] = useState(currentYear);
  const [yearTo, setYearTo] = useState(currentYear);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const {
    rows,
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
          onProjectChange={setSelectedProjectId}
        />
        <BdrTable
          rows={rows}
          overheadExpanded={overheadExpanded}
          costExpanded={costExpanded}
          onToggleOverhead={toggleOverhead}
          onToggleCost={toggleCost}
          onUpdatePlan={isReadOnly ? undefined : (code, month, amount) => updateEntry(code, month, amount, 'plan')}
          onUpdateFact={isReadOnly ? undefined : (code, month, amount) => updateEntry(code, month, amount, 'fact')}
          onOpenSub={setOpenSubType}
        />
      </Card>
      {openSubType && (
        <BdrSubModal
          subType={openSubType}
          year={yearFrom}
          onClose={handleSubClose}
        />
      )}
    </>
  );
};
