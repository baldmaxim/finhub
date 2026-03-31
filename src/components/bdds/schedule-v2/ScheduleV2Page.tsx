import { useState, useCallback } from 'react';
import { Card, Spin, Alert, Tabs, Button, message, Popconfirm } from 'antd';
import { ArrowLeftOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useScheduleV2 } from '../../../hooks/useScheduleV2';
import { ScheduleV2Toolbar } from './ScheduleV2Toolbar';
import { ScheduleV2CostTable } from './ScheduleV2CostTable';
import { ScheduleV2MonthlyTable } from './ScheduleV2MonthlyTable';

export const ScheduleV2Page = () => {
  const navigate = useNavigate();
  const [yearFrom, setYearFrom] = useState(2026);
  const [yearTo, setYearTo] = useState(2028);
  const [activeTab, setActiveTab] = useState('cost');

  const {
    projectName,
    costGroup,
    setCostGroup,
    costRows,
    monthlyRows,
    monthKeys,
    loading,
    error,
    fillBdds,
    filling,
  } = useScheduleV2(yearFrom, yearTo);

  const handleFillBdds = useCallback(async () => {
    try {
      const count = await fillBdds();
      message.success(`БДДС и БДР заполнены: ${count} записей из Плановый график 2.0`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Ошибка заполнения');
    }
  }, [fillBdds]);

  const handleYearFromChange = useCallback((y: number) => {
    setYearFrom(y);
    if (y > yearTo) setYearTo(y);
  }, [yearTo]);

  const handleYearToChange = useCallback((y: number) => {
    setYearTo(y);
    if (y < yearFrom) setYearFrom(y);
  }, [yearFrom]);

  if (error) {
    return <Alert type="error" message="Ошибка" description={error} showIcon />;
  }

  const toolbar = (
    <ScheduleV2Toolbar
      costGroup={costGroup}
      onCostGroupChange={setCostGroup}
      yearFrom={yearFrom}
      yearTo={yearTo}
      onYearFromChange={handleYearFromChange}
      onYearToChange={handleYearToChange}
    />
  );

  const costContent = (
    <>
      {toolbar}
      {loading ? (
        <div className="page-center"><Spin size="large" /></div>
      ) : (
        <ScheduleV2CostTable rows={costRows} />
      )}
    </>
  );

  const monthlyContent = (
    <>
      {toolbar}
      {loading ? (
        <div className="page-center"><Spin size="large" /></div>
      ) : (
        <ScheduleV2MonthlyTable rows={monthlyRows} monthKeys={monthKeys} />
      )}
    </>
  );

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
          Плановый график 2.0 — {projectName || 'Загрузка...'}
        </span>
      }
      extra={
        <Popconfirm
          title="Заполнить БДДС и БДР?"
          description={`Данные из режима «${costGroup === 'commercial' ? 'Коммерческие' : 'Прямые'}» будут записаны в БДДС и БДР. Старые данные по проекту будут перезаписаны.`}
          onConfirm={handleFillBdds}
          okText="Заполнить"
          cancelText="Отмена"
        >
          <Button
            type="primary"
            icon={<UploadOutlined />}
            loading={filling}
          >
            Заполнить БДДС/БДР
          </Button>
        </Popconfirm>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'cost', label: 'Расчёт стоимости', children: costContent },
          { key: 'monthly', label: 'Помесячный план', children: monthlyContent },
        ]}
      />
    </Card>
  );
};
