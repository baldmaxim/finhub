import { FC, useMemo } from 'react';
import { Card } from 'antd';
import { Mix } from '@ant-design/charts';
import type { IBddsDashboardData } from '../../../types/dashboard';

interface IProps {
  data: IBddsDashboardData;
}

export const BddsPlanFactChart: FC<IProps> = ({ data }) => {
  const { redAreaData, greenAreaData, lineData } = useMemo(() => {
    const raw = data.planFactIncome;
    const months: string[] = [];
    const planMap = new Map<string, number>();
    const factMap = new Map<string, number>();

    for (const pt of raw) {
      if (pt.type === 'План') {
        planMap.set(pt.month, pt.value);
        months.push(pt.month);
      } else {
        factMap.set(pt.month, pt.value);
      }
    }

    const redAreaData = months.map(m => {
      const plan = planMap.get(m) ?? 0;
      const fact = factMap.get(m) ?? 0;
      return { month: m, upper: plan, lower: Math.min(plan, fact) };
    });

    const greenAreaData = months.map(m => {
      const plan = planMap.get(m) ?? 0;
      const fact = factMap.get(m) ?? 0;
      return { month: m, upper: fact, lower: Math.min(plan, fact) };
    });

    return { redAreaData, greenAreaData, lineData: raw };
  }, [data.planFactIncome]);

  const config = {
    children: [
      {
        type: 'area' as const,
        data: redAreaData,
        encode: { x: 'month', y: ['lower', 'upper'] },
        style: { fill: '#ff4d4f', fillOpacity: 0.25, stroke: 'transparent' },
        tooltip: false,
        axis: false,
        legend: false,
      },
      {
        type: 'area' as const,
        data: greenAreaData,
        encode: { x: 'month', y: ['lower', 'upper'] },
        style: { fill: '#52c41a', fillOpacity: 0.25, stroke: 'transparent' },
        tooltip: false,
        axis: false,
        legend: false,
      },
      {
        type: 'line' as const,
        data: lineData,
        encode: { x: 'month', y: 'value', color: 'type' },
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
        style: { lineWidth: 2 },
      },
    ],
    interaction: {
      tooltip: { shared: true },
    },
  };

  return (
    <Card title="Поступления: план vs факт" size="small" className="dashboard-chart-card">
      <Mix {...config} height={300} />
    </Card>
  );
};
