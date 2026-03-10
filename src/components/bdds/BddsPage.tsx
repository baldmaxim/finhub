import { useState, useCallback } from 'react';
import { Card, Spin, Alert, message } from 'antd';
import { useBdds } from '../../hooks/useBdds';
import { BddsToolbar } from './BddsToolbar';
import { BddsTable } from './BddsTable';

const currentYear = new Date().getFullYear();

export const BddsPage = () => {
  const [yearFrom, setYearFrom] = useState(currentYear);
  const [yearTo, setYearTo] = useState(currentYear);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const { sections, loading, saving, error, expandedParents, toggleParent, updateFactEntry, saveAll } = useBdds(yearFrom, yearTo, selectedProjectId);

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
      message.error('Ошибка при сохранении');
    }
  };

  if (error) {
    return <Alert type="error" message="Ошибка" description={error} showIcon />;
  }

  return (
    <Card title="БДДС — Бюджет движения денежных средств">
      <BddsToolbar
        yearFrom={yearFrom}
        yearTo={yearTo}
        onYearFromChange={handleYearFromChange}
        onYearToChange={handleYearToChange}
        onSave={handleSave}
        saving={saving}
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
      />
      {loading ? (
        <div className="page-center">
          <Spin size="large" />
        </div>
      ) : (
        <BddsTable
          sections={sections}
          expandedParents={expandedParents}
          onToggleParent={toggleParent}
          onUpdateFact={isReadOnly ? undefined : updateFactEntry}
        />
      )}
    </Card>
  );
};
