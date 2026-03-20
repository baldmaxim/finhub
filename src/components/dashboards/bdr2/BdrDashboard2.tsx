import type { FC } from 'react';
import { Empty, Spin } from 'antd';
import { BdrBubbleChart } from './BdrBubbleChart';
import { BdrExecutionVsKsChart } from './BdrExecutionVsKsChart';
import { BdrMaterialsDeltaChart } from './BdrMaterialsDeltaChart';
import type { IBubbleDataPoint, IExecutionVsKsPoint, IMaterialsDeltaData } from '../../../types/dashboard';

interface IProps {
  bubbleData: IBubbleDataPoint[];
  executionVsKsData: IExecutionVsKsPoint[];
  materialsDelta: IMaterialsDeltaData | null;
  loading: boolean;
}

export const BdrDashboard2: FC<IProps> = ({ bubbleData, executionVsKsData, materialsDelta, loading }) => {
  if (loading) return <Spin size="large" className="dashboard-spin" />;

  const hasData = bubbleData.length > 0 || executionVsKsData.length > 0 || (materialsDelta && materialsDelta.columns.length > 0);
  if (!hasData) return <Empty description="Нет данных по проектам" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {bubbleData.length > 0 && <BdrBubbleChart data={bubbleData} />}
      {executionVsKsData.length > 0 && <BdrExecutionVsKsChart data={executionVsKsData} />}
      {materialsDelta && materialsDelta.columns.length > 0 && <BdrMaterialsDeltaChart data={materialsDelta} />}
    </div>
  );
};
