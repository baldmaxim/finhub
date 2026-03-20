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
          name: '',
          valueFormatter: (v: number) => v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽',
        },
      ],
      render: (_: unknown, { items }: { items: Array<{ name: string; value: string; color: string }> }) => {
        return `<div style="padding:8px">
          ${items.map((item) => {
            const label = item.color === '#1890ff' ? 'План' : 'Факт';
            return `<div><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color};margin-right:6px"></span>${label}: ${item.value}</div>`;
          }).join('')}
        </div>`;
      },
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
