import { FC, useMemo, useState } from 'react';
import { Card, Radio } from 'antd';
import { Mix } from '@ant-design/charts';
import type { IBddsDashboardData } from '../../../types/dashboard';

type ChartMode = 'monthly' | 'cumulative';

interface IProps {
  data: IBddsDashboardData;
}

export const BddsPlanFactChart: FC<IProps> = ({ data }) => {
  const [mode, setMode] = useState<ChartMode>('monthly');

  const { redAreaData, greenAreaData, lineData, cumulativeData } = useMemo(() => {
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

    let cumPlan = 0;
    let cumFact = 0;
    const cumulativeData: Array<{ month: string; value: number; type: string }> = [];
    for (const m of months) {
      cumPlan += planMap.get(m) ?? 0;
      cumFact += factMap.get(m) ?? 0;
      cumulativeData.push({ month: m, value: cumPlan, type: 'План' });
      cumulativeData.push({ month: m, value: cumFact, type: 'Факт' });
    }

    const cumRedAreaData = months.map(m => {
      const cumPlanVal = cumulativeData.find(d => d.month === m && d.type === 'План')?.value ?? 0;
      const cumFactVal = cumulativeData.find(d => d.month === m && d.type === 'Факт')?.value ?? 0;
      return { month: m, upper: cumPlanVal, lower: Math.min(cumPlanVal, cumFactVal) };
    });

    const cumGreenAreaData = months.map(m => {
      const cumPlanVal = cumulativeData.find(d => d.month === m && d.type === 'План')?.value ?? 0;
      const cumFactVal = cumulativeData.find(d => d.month === m && d.type === 'Факт')?.value ?? 0;
      return { month: m, upper: cumFactVal, lower: Math.min(cumPlanVal, cumFactVal) };
    });

    return { redAreaData, greenAreaData, lineData: raw, cumulativeData, cumRedAreaData, cumGreenAreaData };
  }, [data.planFactIncome]);

  const monthlyConfig = {
    children: [
      {
        type: 'area' as const,
        data: redAreaData,
        xField: 'month',
        yField: 'upper',
        y1Field: 'lower',
        scale: { y: { key: 'yShared', independent: false } },
        style: { fill: '#ff4d4f', fillOpacity: 0.25, stroke: 'transparent' },
        tooltip: false,
        axis: false,
        legend: false,
      },
      {
        type: 'area' as const,
        data: greenAreaData,
        xField: 'month',
        yField: 'upper',
        y1Field: 'lower',
        scale: { y: { key: 'yShared', independent: false } },
        style: { fill: '#52c41a', fillOpacity: 0.25, stroke: 'transparent' },
        tooltip: false,
        axis: false,
        legend: false,
      },
      {
        type: 'line' as const,
        data: lineData,
        xField: 'month',
        yField: 'value',
        colorField: 'type',
        scale: {
          y: { key: 'yShared', independent: false },
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
        tooltip: {
          items: [
            {
              channel: 'y',
              valueFormatter: (v: number) =>
                v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽',
            },
          ],
        },
      },
    ],
    interaction: {
      tooltip: { shared: true },
    },
  };

  const cumulativeConfig = {
    children: [
      {
        type: 'area' as const,
        data: cumRedAreaData,
        xField: 'month',
        yField: 'upper',
        y1Field: 'lower',
        scale: { y: { key: 'yShared', independent: false } },
        style: { fill: '#ff4d4f', fillOpacity: 0.25, stroke: 'transparent' },
        tooltip: false,
        axis: false,
        legend: false,
      },
      {
        type: 'area' as const,
        data: cumGreenAreaData,
        xField: 'month',
        yField: 'upper',
        y1Field: 'lower',
        scale: { y: { key: 'yShared', independent: false } },
        style: { fill: '#52c41a', fillOpacity: 0.25, stroke: 'transparent' },
        tooltip: false,
        axis: false,
        legend: false,
      },
      {
        type: 'line' as const,
        data: cumulativeData,
        xField: 'month',
        yField: 'value',
        colorField: 'type',
        scale: {
          y: { key: 'yShared', independent: false },
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
        tooltip: {
          items: [
            {
              channel: 'y',
              valueFormatter: (v: number) =>
                v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽',
            },
          ],
        },
      },
    ],
    interaction: {
      tooltip: { shared: true },
    },
  };

  const titleExtra = (
    <Radio.Group
      value={mode}
      onChange={e => setMode(e.target.value)}
      size="small"
      optionType="button"
      buttonStyle="solid"
    >
      <Radio.Button value="monthly">Помесячно</Radio.Button>
      <Radio.Button value="cumulative">Нарастающий итог</Radio.Button>
    </Radio.Group>
  );

  return (
    <Card title="Поступления: план vs факт" extra={titleExtra} size="small" className="dashboard-chart-card">
      {mode === 'monthly' ? (
        <Mix {...monthlyConfig} height={300} />
      ) : (
        <Mix {...cumulativeConfig} height={300} />
      )}
    </Card>
  );
};
