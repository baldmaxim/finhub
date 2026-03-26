import { type FC, useMemo, useRef } from 'react';
import { Card, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Column } from '@ant-design/charts';
import type { IBdrDashboardData } from '../../../types/dashboard';
import { ShareChartButton } from '../../common/ShareChartButton';

interface IProps {
  data: IBdrDashboardData;
}

const HELP_TEXT = `График состоит из столбиков, которые «шагают» вниз (расходы) или вверх (доходы).

• Первый высокий столбец: Ваша полная Выручка (100%).
• Прямые затраты «съедают» часть выручки ступенями вниз.
• «Валовая прибыль» — промежуточный итог после прямых затрат.
• Далее идут косвенные расходы (Накладные, Пост. расходы).
• Итоговый столбец: Чистая прибыль — финальный результат.`;

interface IChartItem {
  name: string;
  value: [number, number];
  colorType: 'income' | 'expense' | 'totalPositive' | 'totalNegative';
  rawValue: number;
  revenueValue: number;
  isTotal: boolean;
}

const COLOR_MAP: Record<string, string> = {
  income: '#1890ff',
  expense: '#ff7a45',
  totalPositive: '#52c41a',
  totalNegative: '#ff4d4f',
};

const formatMln = (v: number): string => {
  const mln = v / 1_000_000;
  const sign = v < 0 ? '-' : '';
  return `${sign}${Math.abs(mln).toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
};

export const BdrWaterfallChart: FC<IProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const chartData = useMemo(() => {
    const items = data.waterfall;
    const result: IChartItem[] = [];
    const revenueValue = items[0]?.value || 0;

    let running = 0;
    for (const item of items) {
      const isTotal = !!item.isTotal;

      if (isTotal) {
        const val = item.value;
        result.push({
          name: item.name,
          value: val >= 0 ? [0, val] : [val, 0],
          colorType: item.name === 'Выручка' ? 'income' : val >= 0 ? 'totalPositive' : 'totalNegative',
          rawValue: val,
          revenueValue,
          isTotal: true,
        });
        running = val;
      } else {
        const start = running;
        running += item.value;
        result.push({
          name: item.name,
          value: [Math.min(start, running), Math.max(start, running)],
          colorType: 'expense',
          rawValue: item.value,
          revenueValue,
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
    colorField: 'colorType',
    scale: {
      color: {
        domain: Object.keys(COLOR_MAP),
        range: Object.values(COLOR_MAP),
      },
    },
    axis: {
      x: {
        labelAutoRotate: true,
      },
      y: {
        title: 'Сумма (млн руб.)',
        titleFontSize: 11,
        labelFormatter: (v: number) => {
          const mln = v / 1_000_000;
          return mln % 1 === 0 ? mln.toFixed(0) : mln.toFixed(1);
        },
      },
    },
    label: {
      text: (d: IChartItem) => formatMln(d.rawValue),
      position: 'inside' as const,
      fill: '#fff',
      fontSize: 11,
      fontWeight: 600,
    },
    interaction: {
      tooltip: {
        render: (_: unknown, { items }: { items: Array<{ value: unknown }> }) => {
          const firstItem = items[0] as { data?: IChartItem };
          const d = firstItem?.data;
          if (!d) return '';

          const absVal = Math.abs(d.rawValue);
          const mlnStr = formatMln(d.rawValue);
          const pctOfRevenue = d.revenueValue ? ((absVal / d.revenueValue) * 100).toFixed(0) : '0';

          if (d.isTotal) {
            return `<div style="padding:4px 0;font-size:13px;line-height:1.6">
              <div style="font-weight:600;margin-bottom:2px">${d.name}</div>
              <div>${mlnStr} млн руб.</div>
              <div>${pctOfRevenue}% от выручки</div>
            </div>`;
          }

          return `<div style="padding:4px 0;font-size:13px;line-height:1.6">
            <div style="font-weight:600;margin-bottom:2px">${d.name}</div>
            <div>${mlnStr} млн руб. (${pctOfRevenue}% от выручки)</div>
          </div>`;
        },
      },
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
    <div ref={chartRef}>
      <Card title={title} extra={<ShareChartButton chartRef={chartRef} title="Водопад" />} size="small" className="dashboard-chart-card">
        <Column {...config} height={300} />
      </Card>
    </div>
  );
};
