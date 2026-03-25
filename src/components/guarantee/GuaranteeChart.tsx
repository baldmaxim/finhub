import { type FC, useRef } from 'react';
import { Card, Empty } from 'antd';
import { Column } from '@ant-design/charts';
import type { GuaranteeRow } from '../../types/guarantee';
import { MONTHS } from '../../utils/constants';
import { ShareChartButton } from '../common/ShareChartButton';

interface IProps {
  rows: GuaranteeRow[];
  selectedYear: number;
}

interface ChartDataItem {
  project: string;
  month: string;
  value: number;
  type: string;
}

export const GuaranteeChart: FC<IProps> = ({ rows, selectedYear }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartData: ChartDataItem[] = [];

  for (const row of rows) {
    for (const m of row.months) {
      if (m.returnPlan === 0 && m.returnFact === 0) continue;
      const [, monthStr] = m.monthKey.split('-');
      const monthNum = parseInt(monthStr, 10);
      const monthInfo = MONTHS.find((mo) => mo.key === monthNum);
      const label = `${row.projectName}\n${monthInfo?.short ?? monthStr}`;

      if (m.returnPlan > 0) {
        chartData.push({
          project: label,
          month: monthInfo?.short ?? monthStr,
          value: m.returnPlan,
          type: 'План',
        });
      }
      if (m.returnFact > 0) {
        chartData.push({
          project: label,
          month: monthInfo?.short ?? monthStr,
          value: m.returnFact,
          type: 'Факт',
        });
      }
    }
  }

  if (chartData.length === 0) {
    return (
      <Card title={`Возврат ГУ — ${selectedYear}`} size="small" className="guarantee-chart-card">
        <Empty description="Нет данных для отображения" />
      </Card>
    );
  }

  const config = {
    data: chartData,
    xField: 'project',
    yField: 'value',
    colorField: 'type',
    group: true,
    scale: {
      color: {
        domain: ['План', 'Факт'],
        range: ['#1890ff', '#52c41a'],
      },
    },
    axis: {
      y: {
        labelFormatter: (v: number) => {
          if (v >= 1000000) return (v / 1000000).toFixed(1) + 'М';
          if (v >= 1000) return (v / 1000).toFixed(0) + 'К';
          return String(v);
        },
      },
      x: {
        labelAutoRotate: true,
      },
    },
    tooltip: {
      items: [
        {
          channel: 'y',
          valueFormatter: (v: number) => v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' руб.',
        },
      ],
    },
    style: {
      radiusTopLeft: 4,
      radiusTopRight: 4,
    },
  };

  return (
    <div ref={chartRef}>
      <Card title={`Возврат ГУ — ${selectedYear}`} extra={<ShareChartButton chartRef={chartRef} title={`Возврат ГУ — ${selectedYear}`} />} size="small" className="guarantee-chart-card">
        <Column {...config} height={350} />
      </Card>
    </div>
  );
};
