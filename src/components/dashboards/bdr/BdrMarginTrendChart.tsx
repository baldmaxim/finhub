import { type FC, useMemo, useRef, useState } from 'react';
import { Card, Tooltip, InputNumber, Space } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { DualAxes } from '@ant-design/charts';
import type { IBdrDashboardData } from '../../../types/dashboard';
import { ShareChartButton } from '../../common/ShareChartButton';

interface IProps {
  data: IBdrDashboardData;
}

const HELP_TEXT = `Комбинированный график маржинальности и объёмов выручки.

1. Валовая маржа (%) = (Выручка − Себестоимость) / Выручка × 100
Показывает эффективность производства: сколько остаётся после прямых затрат.

2. Чистая маржа (%) = (Выручка − Себестоимость − Пост. расходы) / Выручка × 100
Учитывает бэк-офис (аренда, АУП, юристы). Заштрихованная область между линиями — стоимость содержания бэк-офиса.

3. Линия бенчмарка — целевая маржинальность. Всё, что ниже — работа «ради работы».

4. Пунктирные трендлайны сглаживают «пилу» и показывают глобальное направление.

5. Столбцы выручки позволяют отследить «ножницы»: рост объёмов при падении маржи = демпинг на тендерах.`;

function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] || 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export const BdrMarginTrendChart: FC<IProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [benchmark, setBenchmark] = useState(15);
  const points = data.marginTrend;

  const { marginLines, areaData, trendLines, revenueColumns, benchmarkData } = useMemo(() => {
    const marginLines: Array<{ month: string; value: number; type: string }> = [];
    const areaData: Array<{ month: string; upper: number; lower: number }> = [];
    const revenueColumns: Array<{ month: string; value: number }> = [];

    const grossValues: number[] = [];
    const netValues: number[] = [];

    for (const pt of points) {
      marginLines.push({ month: pt.month, value: pt.grossMargin, type: 'Валовая маржа' });
      marginLines.push({ month: pt.month, value: pt.netMargin, type: 'Чистая маржа' });
      areaData.push({
        month: pt.month,
        upper: pt.grossMargin,
        lower: pt.netMargin,
      });
      revenueColumns.push({ month: pt.month, value: pt.revenueFact });
      grossValues.push(pt.grossMargin);
      netValues.push(pt.netMargin);
    }

    const grossReg = linearRegression(grossValues);
    const netReg = linearRegression(netValues);
    const trendLines: Array<{ month: string; value: number; type: string }> = [];

    for (let i = 0; i < points.length; i++) {
      trendLines.push({
        month: points[i].month,
        value: grossReg.intercept + grossReg.slope * i,
        type: 'Тренд валовой',
      });
      trendLines.push({
        month: points[i].month,
        value: netReg.intercept + netReg.slope * i,
        type: 'Тренд чистой',
      });
    }

    const benchmarkData = [benchmark];

    return { marginLines, areaData, trendLines, revenueColumns, benchmarkData };
  }, [points, benchmark]);

  const pctFormatter = (v: number) => v.toFixed(1) + '%';
  const rubFormatter = (v: number) =>
    v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';

  const config = {
    xField: 'month',
    children: [
      // Revenue bars (right Y axis)
      {
        data: revenueColumns,
        type: 'interval' as const,
        yField: 'value',
        style: {
          fill: '#d9d9d9',
          fillOpacity: 0.45,
          maxWidth: 40,
        },
        axis: {
          y: {
            position: 'right' as const,
            title: 'Выручка, ₽',
            titleFontSize: 11,
            labelFormatter: (v: number) => (v / 1000000).toFixed(1) + 'М',
          },
        },
        tooltip: {
          items: [
            (d: Record<string, number>) => ({
              name: 'Выручка',
              value: rubFormatter(d.value),
              color: '#d9d9d9',
            }),
          ],
        },
      },
      // Shaded area between gross and net margin
      {
        data: areaData,
        type: 'area' as const,
        yField: 'upper',
        y1Field: 'lower',
        style: {
          fill: '#faad14',
          fillOpacity: 0.18,
          stroke: 'transparent',
        },
        scale: { y: { key: 'pct', independent: false } },
        axis: false,
        legend: false,
        tooltip: false,
      },
      // Margin lines
      {
        data: marginLines,
        type: 'line' as const,
        yField: 'value',
        colorField: 'type',
        scale: {
          y: { key: 'pct', independent: false },
          color: {
            domain: ['Валовая маржа', 'Чистая маржа'],
            range: ['#52c41a', '#1890ff'],
          },
        },
        style: { lineWidth: 2.5 },
        axis: {
          y: {
            position: 'left' as const,
            title: 'Маржа, %',
            titleFontSize: 11,
            labelFormatter: pctFormatter,
          },
        },
        tooltip: {
          items: [
            {
              channel: 'y',
              valueFormatter: pctFormatter,
            },
          ],
        },
      },
      // Trend lines (dashed)
      {
        data: trendLines,
        type: 'line' as const,
        yField: 'value',
        colorField: 'type',
        scale: {
          y: { key: 'pct', independent: false },
          color: {
            domain: ['Тренд валовой', 'Тренд чистой'],
            range: ['#52c41a', '#1890ff'],
          },
        },
        style: {
          lineWidth: 1.5,
          lineDash: [6, 4],
          opacity: 0.6,
        },
        axis: false,
        tooltip: false,
        legend: false,
      },
      // Benchmark line
      {
        type: 'lineY' as const,
        data: benchmarkData,
        scale: { y: { key: 'pct', independent: false } },
        style: {
          stroke: '#ff4d4f',
          strokeOpacity: 0.7,
          lineDash: [8, 4],
          lineWidth: 1.5,
        },
      },
    ],
  };

  const titleExtra = (
    <Space size="small" align="center">
      <span style={{ fontSize: 12 }}>Бенчмарк:</span>
      <InputNumber
        size="small"
        min={0}
        max={100}
        value={benchmark}
        onChange={(v) => v !== null && setBenchmark(v)}
        formatter={(v) => `${v}%`}
        parser={(v) => Number(v?.replace('%', '') || 0)}
        style={{ width: 72 }}
      />
      <ShareChartButton chartRef={chartRef} title="Маржинальность и объёмы" />
    </Space>
  );

  const title = (
    <span>
      Маржинальность и объёмы{' '}
      <Tooltip
        title={<span style={{ whiteSpace: 'pre-line' }}>{HELP_TEXT}</span>}
        overlayStyle={{ maxWidth: 480 }}
      >
        <InfoCircleOutlined className="bdr-bubble-help-icon" />
      </Tooltip>
    </span>
  );

  return (
    <div ref={chartRef}>
      <Card title={title} extra={titleExtra} size="small" className="dashboard-chart-card">
        <DualAxes {...config} height={380} />
      </Card>
    </div>
  );
};
