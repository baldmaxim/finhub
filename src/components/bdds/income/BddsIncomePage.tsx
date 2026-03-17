import { useState, useCallback } from 'react';
import { Card, Spin, Alert, message, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useBddsIncome } from '../../../hooks/useBddsIncome';
import { BddsIncomeToolbar } from './BddsIncomeToolbar';
import { BddsIncomeTable } from './BddsIncomeTable';
import type { ExcelImportData } from '../../../types/bddsIncome';

const currentYear = new Date().getFullYear();

export const BddsIncomePage = () => {
  const navigate = useNavigate();
  const [yearFrom, setYearFrom] = useState(currentYear);
  const [yearTo, setYearTo] = useState(currentYear);

  const {
    rows,
    monthKeys,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    loading,
    error,
    importData,
  } = useBddsIncome(yearFrom, yearTo);

  const handleYearFromChange = useCallback((y: number) => {
    setYearFrom(y);
    if (y > yearTo) setYearTo(y);
  }, [yearTo]);

  const handleYearToChange = useCallback((y: number) => {
    setYearTo(y);
    if (y < yearFrom) setYearFrom(y);
  }, [yearFrom]);

  const handleImport = async (data: ExcelImportData[]) => {
    if (!selectedProjectId) {
      message.error('Выберите проект для импорта');
      return;
    }
    try {
      await importData(selectedProjectId, data);
      message.success('Данные импортированы');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Ошибка импорта:', err);
      message.error(`Ошибка импорта: ${msg}`, 10);
    }
  };

  if (error) {
    return <Alert type="error" message="Ошибка" description={error} showIcon />;
  }

  return (
    <Card
      title={
        <span>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/bdds')}
            className="mr-8"
          />
          Плановый график выполнения и финансирования проектов
        </span>
      }
    >
      <BddsIncomeToolbar
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
        yearFrom={yearFrom}
        yearTo={yearTo}
        onYearFromChange={handleYearFromChange}
        onYearToChange={handleYearToChange}
        onImport={handleImport}
      />
      {loading ? (
        <div className="page-center">
          <Spin size="large" />
        </div>
      ) : (
        <BddsIncomeTable rows={rows} monthKeys={monthKeys} />
      )}
    </Card>
  );
};
