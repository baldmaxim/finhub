import { useState } from 'react';
import { Card, Spin, Alert, message } from 'antd';
import { useBdds } from '../../hooks/useBdds';
import { BddsToolbar } from './BddsToolbar';
import { BddsTable } from './BddsTable';

export const BddsPage = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const { sections, loading, saving, error, expandedParents, toggleParent, updateFactEntry, saveAll } = useBdds(year, selectedProjectId);

  const isReadOnly = !selectedProjectId;

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
        year={year}
        onYearChange={setYear}
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
