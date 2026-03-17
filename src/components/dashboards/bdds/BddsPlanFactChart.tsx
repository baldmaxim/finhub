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
        {
          channel: 'y',
          valueFormatter: (v: number) => v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽',
        },
      ],
    },
    interaction: {
      tooltip: { shared: true },
    },
    style: {
      lineWidth: 2,
      connect: true,
      connectLineDash: [4, 4],
      connectStroke: '#ccc',
    },
  };

  return (
    <Card title="Поступления: план vs факт" size="small" className="dashboard-chart-card">
      <Line {...config} height={300} />
    </Card>
  );
};
