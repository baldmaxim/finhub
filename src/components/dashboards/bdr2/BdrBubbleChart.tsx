import { type FC, useMemo, useRef } from 'react';
import { Card, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Scatter } from '@ant-design/charts';
import type { IBubbleDataPoint } from '../../../types/dashboard';
import { ShareChartButton } from '../../common/ShareChartButton';

interface IProps {
  data: IBubbleDataPoint[];
}

const HELP_TEXT = `Как читать этот график для принятия решений:

Положение по горизонтали (Ось X): Масштаб проекта (Выручка). Чем правее — тем больше влияние на оборот.

Положение по вертикали (Ось Y): Эффективность (Рентабельность %).
• Верхние квадранты: Зона успеха — хорошая маржа.
• Нижние квадранты: Зона риска — грань окупаемости.

Размер пузырька: Абсолютная валовая прибыль. Чем больше круг — тем больше абсолютный вклад в прибыль.

Пунктирные линии: Средняя выручка и средняя рентабельность — делят поле на 4 квадранта.`;

const formatMln = (v: number): string =>
  (v / 1_000_000).toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const BdrBubbleChart: FC<IProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  // Средние значения для reference lines
  const { avgRevenue, avgProfitability } = useMemo(() => {
    if (!data.length) return { avgRevenue: 0, avgProfitability: 0 };
    const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
    const totalProfit = data.reduce((s, d) => s + d.profitability, 0);
    return {
      avgRevenue: totalRevenue / data.length,
      avgProfitability: totalProfit / data.length,
    };
  }, [data]);

  const config = {
    data,
    xField: 'revenue',
    yField: 'profitability',
    sizeField: 'grossProfit',
    size: { range: [12, 60] },
    shapeField: 'point',
    style: {
      fill: '#1890ff',
      fillOpacity: 0.6,
      stroke: '#1890ff',
      strokeOpacity: 0.8,
      lineWidth: 1,
    },
    scale: {
      size: {
        range: [12, 60],
      },
    },
    axis: {
      x: {
        title: 'Выручка (млн руб.)',
        titleFontSize: 11,
        labelFormatter: (v: number) => {
          const mln = v / 1_000_000;
          return mln % 1 === 0 ? mln.toFixed(0) : mln.toFixed(1);
        },
      },
      y: {
        title: 'Рентабельность (%)',
        titleFontSize: 11,
        labelFormatter: (v: number) => v.toFixed(0) + '%',
      },
    },
    // Reference lines — средняя выручка и средняя рентабельность
    annotations: [
      // Вертикальная линия — средняя выручка
      {
        type: 'lineX' as const,
        xField: avgRevenue,
        style: {
          stroke: '#8c8c8c',
          strokeOpacity: 0.5,
          lineDash: [6, 4],
          lineWidth: 1,
        },
      },
      // Горизонтальная линия — средняя рентабельность
      {
        type: 'lineY' as const,
        yField: avgProfitability,
        style: {
          stroke: '#8c8c8c',
          strokeOpacity: 0.5,
          lineDash: [6, 4],
          lineWidth: 1,
        },
      },
    ],
    interaction: {
      tooltip: {
        render: (_: unknown, { items }: { items: Array<{ value: unknown }> }) => {
          const firstItem = items[0] as { data?: IBubbleDataPoint };
          const d = firstItem?.data;
          if (!d) return '';
          return `<div style="padding:4px 0;font-size:13px;line-height:1.6">
            <div style="font-weight:600;margin-bottom:4px">${d.project}</div>
            <div>Выручка: <b>${formatMln(d.revenue)} млн руб.</b></div>
            <div>Рентабельность: <b>${d.profitability.toFixed(1)}%</b></div>
            <div>Валовая прибыль: <b>${formatMln(d.grossProfit)} млн руб.</b></div>
          </div>`;
        },
      },
    },
    legend: false as const,
    label: {
      text: 'project',
      position: 'top' as const,
      style: {
        fontSize: 10,
        fill: '#595959',
        dy: -8,
      },
      layout: [
        { type: 'overlapDodgeY' as const },
      ],
    },
  };

  const title = (
    <span>
      Матрица маржинальности по объектам{' '}
      <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{HELP_TEXT}</span>} overlayStyle={{ maxWidth: 480 }}>
        <InfoCircleOutlined className="bdr-bubble-help-icon" />
      </Tooltip>
    </span>
  );

  return (
    <div ref={chartRef}>
      <Card title={title} extra={<ShareChartButton chartRef={chartRef} title="Матрица маржинальности" />} size="small" className="dashboard-chart-card">
        <Scatter {...config} height={420} />
      </Card>
    </div>
  );
};
