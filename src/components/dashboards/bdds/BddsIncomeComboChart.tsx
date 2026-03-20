import type { FC } from 'react';
import { Card } from 'antd';
import { DualAxes } from '@ant-design/charts';
import type { IBddsDashboardData } from '../../../types/dashboard';

interface IProps {
  data: IBddsDashboardData;
}

export const BddsIncomeComboChart: FC<IProps> = ({ data }) => {
  const hasProjectData = data.incomeByProject.length > 0;

  if (!hasProjectData) return null;

  const valueFormatter = (v: number) =>
    v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';

  const config = {
    xField: 'month',
    children: [
      {
        data: data.incomeByProject,
        type: 'interval' as const,
        yField: 'value',
        colorField: 'project',
        stack: true,
        scale: {
          color: {
            type: 'ordinal',
            range: [
              '#1890ff', '#52c41a', '#faad14', '#722ed1', '#13c2c2',
              '#eb2f96', '#fa8c16', '#2f54eb', '#a0d911', '#ff4d4f',
            ],
          },
        },
        style: {
          maxWidth: 40,
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
              valueFormatter,
            },
          ],
        },
        interaction: {
          tooltip: { shared: true },
        },
      },
      {
        data: data.planIncomeLine,
        type: 'line' as const,
        yField: 'value',
        colorField: 'type',
        scale: {
          color: {
            domain: ['План'],
            range: ['#ff4d4f'],
          },
        },
        style: {
          lineWidth: 2.5,
          lineDash: [6, 4],
        },
        tooltip: {
          items: [
            {
              channel: 'y',
              valueFormatter,
            },
          ],
        },
      },
    ],
  };

  return (
    <Card
      title="Поступления по проектам: факт (столбцы) + план (линия)"
      size="small"
      className="dashboard-chart-card"
    >
      <DualAxes {...config} height={350} />
    </Card>
  );
};
