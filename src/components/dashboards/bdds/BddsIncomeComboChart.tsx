import { type FC, useRef } from 'react';
import { Card } from 'antd';
import { DualAxes } from '@ant-design/charts';
import type { IBddsDashboardData, IIncomeByProjectPoint, IMonthDataPoint } from '../../../types/dashboard';
import { ShareChartButton } from '../../common/ShareChartButton';

interface IProps {
  data: IBddsDashboardData;
}

export const BddsIncomeComboChart: FC<IProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const hasProjectData = data.incomeByProject.length > 0;

  if (!hasProjectData) return null;

  const valueFormatter = (v: number) =>
    v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';

  const config = {
    xField: 'month',
    interaction: {
      tooltip: { shared: true },
    },
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
            (d: IIncomeByProjectPoint) => ({
              name: d.project,
              value: valueFormatter(d.value),
            }),
          ],
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
            (d: IMonthDataPoint) => ({
              name: d.type,
              value: valueFormatter(d.value),
            }),
          ],
        },
      },
    ],
  };

  return (
    <div ref={chartRef}>
      <Card
        title="Поступления по проектам: факт (столбцы) + план (линия)"
        extra={<ShareChartButton chartRef={chartRef} title="Поступления по проектам" />}
        size="small"
        className="dashboard-chart-card"
      >
        <DualAxes {...config} height={350} />
      </Card>
    </div>
  );
};
