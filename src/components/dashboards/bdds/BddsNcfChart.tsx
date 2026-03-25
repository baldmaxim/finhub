import { type FC, useRef } from 'react';
import { Card } from 'antd';
import { Area } from '@ant-design/charts';
import type { IBddsDashboardData } from '../../../types/dashboard';
import { ShareChartButton } from '../../common/ShareChartButton';

interface IProps {
  data: IBddsDashboardData;
}

export const BddsNcfChart: FC<IProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const config = {
    data: data.ncfBySection,
    xField: 'month',
    yField: 'value',
    colorField: 'type',
    stack: true,
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
      fillOpacity: 0.6,
    },
  };

  return (
    <div ref={chartRef}>
      <Card title="ЧДП по секциям" extra={<ShareChartButton chartRef={chartRef} title="ЧДП по секциям" />} size="small" className="dashboard-chart-card">
        <Area {...config} height={300} />
      </Card>
    </div>
  );
};
