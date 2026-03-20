import type { FC } from 'react';
import { Card } from 'antd';
import { Line } from '@ant-design/charts';
import type { IBddsDashboardData } from '../../../types/dashboard';

interface IProps {
  data: IBddsDashboardData;
}

export const BddsPlanFactChart: FC<IProps> = ({ data }) => {
  const config = {
    data: data.planFactIncome,
    xField: 'month',
    yField: 'value',
    colorField: 'type',
    scale: {
      color: {
        domain: ['План', 'Факт'],
        range: ['#1890ff', '#52c41a'],
      },
    },
    axis: {
      y: {
        labelFormatter: (v: number) => (v / 1000000).toFixed(1) + 'М',
      },
    },
    tooltip: {
      items: [
        (d: Record<string, unknown>) => ({
          name: d.type as string,
          value: (d.value as number).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽',
          color: d.type === 'План' ? '#1890ff' : '#52c41a',
        }),
      ],
    },
    interaction: {
      tooltip: { shared: true },
    },
    style: {
      lineWidth: 2,
    },
  };

  return (
    <Card title="Поступления: план vs факт" size="small" className="dashboard-chart-card">
      <Line {...config} height={300} />
    </Card>
  );
};
