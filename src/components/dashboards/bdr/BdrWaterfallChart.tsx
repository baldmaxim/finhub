import type { FC } from 'react';
import { useMemo } from 'react';
import { Card, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Column } from '@ant-design/charts';
import type { IBdrDashboardData } from '../../../types/dashboard';

interface IProps {
  data: IBdrDashboardData;
}

const HELP_TEXT = `График состоит из столбиков, которые «шагают» вниз (расходы) или вверх (доходы).

• Первый высокий столбец: Ваша полная Выручка (100%).
• Промежуточные ступени вниз: Затраты, сгруппированные по категориям (Себестоимость, Налоги, ОФЗ).
• Итоговый столбец (фундамент): Чистая прибыль, которая осталась «в сухом остатке».`;

export const BdrWaterfallChart: FC<IProps> = ({ data }) => {
  const chartData = useMemo(() => {
    const items = data.waterfall;
    const result: Array<{ name: string; value: [number, number]; isTotal: boolean }> = [];

    let running = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const isTotal = i === 0 || i === items.length - 1;

      if (isTotal) {
        result.push({ name: item.name, value: [0, Math.abs(item.value)], isTotal: true });
        running = item.value;
      } else {
        const start = running;
        running += item.value;
        result.push({
          name: item.name,
          value: [Math.min(start, running), Math.max(start, running)],
          isTotal: false,
        });
      }
    }
    return result;
  }, [data.waterfall]);

  const config = {
    data: chartData,
    xField: 'name',
    yField: 'value',
    colorField: 'isTotal',
    scale: {
      color: {
        domain: [true, false],
        range: ['#1890ff', '#ff7a45'],
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
          valueFormatter: (v: number) => {
            if (Array.isArray(v)) return '';
            return v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
          },
        },
      ],
    },
    legend: false as const,
  };

  const title = (
    <span>
      Водопад: от выручки к чистой прибыли{' '}
      <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{HELP_TEXT}</span>} overlayStyle={{ maxWidth: 480 }}>
        <InfoCircleOutlined className="bdr-bubble-help-icon" />
      </Tooltip>
    </span>
  );

  return (
    <Card title={title} size="small" className="dashboard-chart-card">
      <Column {...config} height={300} />
    </Card>
  );
};
