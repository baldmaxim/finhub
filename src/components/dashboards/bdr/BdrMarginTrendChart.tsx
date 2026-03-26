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

1. Рентабельность План (%) — плановая чистая рентабельность: (Выручка план − Себестоимость план − Пост. расходы план) / Выручка план × 100.

2. Рентабельность Факт (%) — фактическая чистая рентабельность: (Выручка − Себестоимость − Пост. расходы) / Выручка × 100.

3. Заливка между линиями: зелёная — факт выше плана, красная — факт ниже.

4. Линия бенчмарка — целевая маржинальность. Всё, что ниже — работа «ради работы».

5. Столбцы выручки позволяют отследить «ножницы»: рост объёмов при падении маржи = демпинг на тендерах.`;

const LEGEND_ITEMS = [
  { color: '#52c41a', label: 'План %', dash: false },
  { color: '#1890ff', label: 'Факт %', dash: false },
  { color: '#d9d9d9', label: 'Выручка', dash: false, isRect: true },
  { color: '#ff4d4f', label: 'Бенчмарк', dash: true },
];

export const BdrMarginTrendChart: FC<IProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [benchmark, setBenchmark] = useState(15);
  const points = data.marginTrend;

  const { planLines, factLines, areaSegments, revenueColumns, benchmarkData } = useMemo(() => {
    const planLines: Array<{ month: string; value: number; type: string }> = [];
    const factLines: Array<{ month: string; value: number; type: string }> = [];
    const revenueColumns: Array<{ month: string; value: number }> = [];

    // Сегменты заливки: зелёная (факт >= план) или красная (факт < план)
    const areaSegments: Array<{ month: string; upper: number; lower: number; fill: string }> = [];

    for (const pt of points) {
      planLines.push({ month: pt.month, value: pt.planMargin, type: 'План %' });
      factLines.push({ month: pt.month, value: pt.netMargin, type: 'Факт %' });
      revenueColumns.push({ month: pt.month, value: pt.revenueFact });

      const factAbove = pt.netMargin >= pt.planMargin;
      areaSegments.push({
        month: pt.month,
        upper: factAbove ? pt.netMargin : pt.planMargin,
        lower: factAbove ? pt.planMargin : pt.netMargin,
        fill: factAbove ? 'rgba(82, 196, 26, 0.15)' : 'rgba(255, 77, 79, 0.15)',
      });
    }

    const benchmarkData = [benchmark];

    return { planLines, factLines, areaSegments, revenueColumns, benchmarkData };
  }, [points, benchmark]);

  // Объединяем все линии маржинальности для единого слоя
  const allMarginLines = useMemo(() => [...planLines, ...factLines], [planLines, factLines]);

  // Данные для тултипа — собираем в map для быстрого доступа
  const tooltipMap = useMemo(() => {
    const map = new Map<string, { plan: number; fact: number; revenue: number }>();
    for (const pt of points) {
      map.set(pt.month, { plan: pt.planMargin, fact: pt.netMargin, revenue: pt.revenueFact });
    }
    return map;
  }, [points]);

  const pctFormatter = (v: number) => v.toFixed(1) + '%';
  const revenueAxisFormatter = (v: number) => {
    const mln = v / 1_000_000;
    return mln % 1 === 0 ? mln.toFixed(0) : mln.toFixed(1);
  };
  const rubFormatter = (v: number) =>
    (v / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' млн руб.';

  // Минимальное значение маржинальности для выравнивания столбцов
  const minMarginValue = useMemo(() => {
    let min = 0;
    for (const pt of points) {
      if (pt.netMargin < min) min = pt.netMargin;
      if (pt.planMargin < min) min = pt.planMargin;
    }
    return min;
  }, [points]);

  const config = {
    xField: 'month',
    interaction: {
      tooltip: {
        render: (_: unknown, { items }: { items: Array<{ value: unknown }> }) => {
          // Находим месяц из первого элемента
          const firstItem = items[0] as { value: unknown; name?: string; data?: Record<string, unknown> };
          const monthKey = (firstItem?.data?.month as string) || '';
          const info = tooltipMap.get(monthKey);
          if (!info) return '';
          const delta = info.fact - info.plan;
          const deltaSign = delta >= 0 ? '+' : '';
          const deltaColor = delta >= 0 ? '#52c41a' : '#ff4d4f';
          return `<div style="padding:4px 0;font-size:13px;line-height:1.6">
            <div style="font-weight:600;margin-bottom:4px">${monthKey}</div>
            <div>Выручка: <b>${rubFormatter(info.revenue)}</b></div>
            <div>Рентабельность План: <b>${info.plan.toFixed(1)}%</b></div>
            <div>Рентабельность Факт: <b>${info.fact.toFixed(1)}%</b></div>
            <div>Отклонение: <span style="color:${deltaColor};font-weight:600">${deltaSign}${delta.toFixed(1)}%</span> от плана</div>
          </div>`;
        },
      },
    },
    children: [
      // Столбцы выручки (правая ось Y)
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
          x: {
            title: false,
            labelAutoRotate: true,
          },
          y: {
            position: 'right' as const,
            title: 'Выручка (млн руб.)',
            titleFontSize: 11,
            labelFormatter: revenueAxisFormatter,
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
      // Семантическая заливка между план и факт (зелёная/красная)
      ...(() => {
        // Группируем последовательные сегменты одного цвета
        const groups: Array<{ fill: string; data: Array<{ month: string; upper: number; lower: number }> }> = [];
        for (const seg of areaSegments) {
          const last = groups[groups.length - 1];
          if (last && last.fill === seg.fill) {
            last.data.push({ month: seg.month, upper: seg.upper, lower: seg.lower });
          } else {
            // При смене цвета добавляем точку перехода в предыдущую группу
            if (last) {
              last.data.push({ month: seg.month, upper: seg.upper, lower: seg.lower });
            }
            groups.push({ fill: seg.fill, data: [{ month: seg.month, upper: seg.upper, lower: seg.lower }] });
          }
        }
        return groups.map((g, i) => ({
          data: g.data,
          type: 'area' as const,
          yField: 'upper',
          y1Field: 'lower',
          style: {
            fill: g.fill,
            stroke: 'transparent',
          },
          scale: { y: { key: 'pct', independent: false, domainMin: minMarginValue } },
          axis: false,
          legend: false,
          tooltip: false,
          key: `area-${i}`,
        }));
      })(),
      // Линии маржинальности (план + факт)
      {
        data: allMarginLines,
        type: 'line' as const,
        yField: 'value',
        colorField: 'type',
        scale: {
          y: {
            key: 'pct',
            independent: false,
            domainMin: minMarginValue,
          },
          color: {
            domain: ['План %', 'Факт %'],
            range: ['#52c41a', '#1890ff'],
          },
        },
        style: { lineWidth: 2.5 },
        axis: {
          y: {
            position: 'left' as const,
            title: 'Рентабельность (%)',
            titleFontSize: 11,
            labelFormatter: pctFormatter,
          },
        },
        legend: false,
        tooltip: {
          items: [
            {
              channel: 'y',
              valueFormatter: pctFormatter,
            },
          ],
        },
      },
      // Линия бенчмарка (красный пунктир)
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
        {/* Легенда */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
          {LEGEND_ITEMS.map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              {item.isRect ? (
                <span style={{ width: 14, height: 10, background: item.color, opacity: 0.6, display: 'inline-block', borderRadius: 2 }} />
              ) : item.dash ? (
                <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke={item.color} strokeWidth="2" strokeDasharray="4 3" /></svg>
              ) : (
                <span style={{ width: 14, height: 3, background: item.color, display: 'inline-block', borderRadius: 1 }} />
              )}
              <span style={{ color: '#595959' }}>{item.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <span style={{ width: 14, height: 10, background: 'rgba(82, 196, 26, 0.25)', display: 'inline-block', borderRadius: 2 }} />
            <span style={{ color: '#595959' }}>Факт ≥ План</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <span style={{ width: 14, height: 10, background: 'rgba(255, 77, 79, 0.25)', display: 'inline-block', borderRadius: 2 }} />
            <span style={{ color: '#595959' }}>Факт {'<'} План</span>
          </div>
        </div>
        <DualAxes {...config} height={380} />
      </Card>
    </div>
  );
};
