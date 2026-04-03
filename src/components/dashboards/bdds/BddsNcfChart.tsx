import { type FC, useMemo, useRef } from 'react';
import { Card, Tooltip, Statistic, Row, Col } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { DualAxes } from '@ant-design/charts';
import type { IBddsDashboardData } from '../../../types/dashboard';
import { ShareChartButton } from '../../common/ShareChartButton';

interface IProps {
  data: IBddsDashboardData;
}

const HELP_TEXT = `Отчёт о движении денежных средств по видам деятельности.

• Столбцы — ЧДП за месяц: притоки вверх, оттоки вниз.
  Синий = Основная, Зелёный = Инвестиционная, Оранжевый = Финансовая.
• Чёрная линия — итоговый ЧДП (сумма трёх видов за месяц).
  Выше нуля = компания генерирует кэш. Ниже = тратит запасы.`;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _SECTION_COLORS: Record<string, string> = {
  'Основная деятельность': '#1890ff',
  'Инвестиционная деятельность': '#52c41a',
  'Финансовая деятельность': '#fa8c16',
};

const formatMln = (v: number): string =>
  (v / 1_000_000).toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const axisFormatter = (v: number): string => {
  const mln = v / 1_000_000;
  return mln % 1 === 0 ? mln.toFixed(0) : mln.toFixed(1);
};

const LEGEND_ITEMS = [
  { color: '#1890ff', label: 'Основная', isRect: true },
  { color: '#52c41a', label: 'Инвестиционная', isRect: true },
  { color: '#fa8c16', label: 'Финансовая', isRect: true },
  { color: '#262626', label: 'Итоговый ЧДП', isLine: true },
];

export const BddsNcfChart: FC<IProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  if (!data.ncfBySection || data.ncfBySection.length === 0) return null;

  // Обрезаем пустые будущие периоды и строим данные
  const { stackData, lineData, months } = useMemo(() => {
    const raw = data.ncfBySection;
    const monthOrder: string[] = [];
    const monthMap = new Map<string, Record<string, number>>();
    const seen = new Set<string>();

    for (const pt of raw) {
      if (!seen.has(pt.month)) {
        seen.add(pt.month);
        monthOrder.push(pt.month);
        monthMap.set(pt.month, {});
      }
      const entry = monthMap.get(pt.month)!;
      entry[pt.type] = pt.value;
    }

    // Определяем последний месяц с ненулевыми данными
    let lastFactIdx = -1;
    for (let i = monthOrder.length - 1; i >= 0; i--) {
      const entry = monthMap.get(monthOrder[i])!;
      const hasData = Object.values(entry).some((v) => v !== 0);
      if (hasData) { lastFactIdx = i; break; }
    }

    const months = lastFactIdx >= 0 ? monthOrder.slice(0, lastFactIdx + 1) : monthOrder;

    const SECTIONS = ['Основная деятельность', 'Инвестиционная деятельность', 'Финансовая деятельность'];
    const stackData: Array<{ month: string; value: number; type: string }> = [];
    const lineData: Array<{ month: string; value: number; type: string }> = [];

    for (const m of months) {
      const entry = monthMap.get(m)!;
      let total = 0;
      // Гарантируем все три секции в каждом месяце для корректного стека
      for (const section of SECTIONS) {
        const value = entry[section] ?? 0;
        stackData.push({ month: m, value, type: section });
        total += value;
      }
      lineData.push({ month: m, value: total, type: 'Итоговый ЧДП' });
    }

    return { stackData, lineData, months };
  }, [data.ncfBySection]);

  // Tooltip map
  const tooltipMap = useMemo(() => {
    const map = new Map<string, { operating: number; investing: number; financing: number; total: number }>();
    for (const m of months) {
      const ops = stackData.filter((d) => d.month === m);
      const operating = ops.find((d) => d.type === 'Основная деятельность')?.value ?? 0;
      const investing = ops.find((d) => d.type === 'Инвестиционная деятельность')?.value ?? 0;
      const financing = ops.find((d) => d.type === 'Финансовая деятельность')?.value ?? 0;
      map.set(m, { operating, investing, financing, total: operating + investing + financing });
    }
    return map;
  }, [months, stackData]);

  const config = {
    xField: 'month',
    interaction: {
      tooltip: {
        render: (_: unknown, { items }: { items: Array<{ value: unknown }> }) => {
          const firstItem = items[0] as { data?: Record<string, unknown> };
          const monthKey = (firstItem?.data?.month as string) || '';
          const info = tooltipMap.get(monthKey);
          if (!info) return '';
          const totalColor = info.total >= 0 ? '#52c41a' : '#ff4d4f';
          const sign = (v: number) => v >= 0 ? '+' : '';
          return `<div style="padding:4px 0;font-size:13px;line-height:1.6">
            <div style="font-weight:600;margin-bottom:4px">${monthKey}</div>
            <div><span style="color:#1890ff">●</span> Основная: <b>${sign(info.operating)}${formatMln(info.operating)} млн</b></div>
            <div><span style="color:#52c41a">●</span> Инвестиционная: <b>${sign(info.investing)}${formatMln(info.investing)} млн</b></div>
            <div><span style="color:#fa8c16">●</span> Финансовая: <b>${sign(info.financing)}${formatMln(info.financing)} млн</b></div>
            <div style="border-top:1px solid #f0f0f0;margin-top:4px;padding-top:4px">
              Итого: <b style="color:${totalColor}">${sign(info.total)}${formatMln(info.total)} млн</b>
            </div>
          </div>`;
        },
      },
    },
    children: [
      // Stacked столбцы по секциям
      {
        data: stackData,
        type: 'interval' as const,
        yField: 'value',
        colorField: 'type',
        stack: true,
        scale: {
          x: { domain: months },
          y: { key: 'shared' },
          color: {
            domain: ['Основная деятельность', 'Инвестиционная деятельность', 'Финансовая деятельность'],
            range: ['#1890ff', '#52c41a', '#fa8c16'],
          },
        },
        style: {
          fillOpacity: 0.75,
          maxWidth: 32,
        },
        axis: {
          x: {
            title: false,
            labelAutoRotate: false,
            labelAutoHide: true,
            labelAutoEllipsis: true,
          },
          y: {
            title: 'Денежный поток (млн руб.)',
            titleFontSize: 11,
            labelFormatter: axisFormatter,
          },
        },
        legend: false,
        tooltip: {
          items: [
            {
              channel: 'y',
              valueFormatter: (v: number) => formatMln(v) + ' млн',
            },
          ],
        },
      },
      // Линия итогового ЧДП
      {
        data: lineData,
        type: 'line' as const,
        yField: 'value',
        colorField: 'type',
        scale: {
          x: { domain: months },
          y: { key: 'shared' },
          color: {
            domain: ['Итоговый ЧДП'],
            range: ['#262626'],
          },
        },
        style: {
          lineWidth: 2.5,
        },
        point: {
          shapeField: 'circle',
          sizeField: 3,
        },
        axis: false,
        legend: false,
        tooltip: {
          items: [
            (d: Record<string, number | string>) => ({
              name: 'Итого ЧДП',
              value: formatMln(Number(d.value)) + ' млн',
              color: '#262626',
            }),
          ],
        },
      },
      // Нулевая линия
      {
        type: 'lineY' as const,
        data: [0],
        style: {
          stroke: '#8c8c8c',
          strokeOpacity: 0.4,
          lineDash: [4, 4],
          lineWidth: 1,
        },
      },
    ],
  };

  const { kpis } = data;
  const totalColor = kpis.ncfTotal >= 0 ? '#52c41a' : '#ff4d4f';

  const title = (
    <span>
      ЧДП по секциям{' '}
      <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{HELP_TEXT}</span>} overlayStyle={{ maxWidth: 480 }}>
        <InfoCircleOutlined className="bdr-bubble-help-icon" />
      </Tooltip>
    </span>
  );

  return (
    <div ref={chartRef}>
      <Card title={title} extra={<ShareChartButton chartRef={chartRef} title="ЧДП по секциям" />} size="small" className="dashboard-chart-card">
        {/* KPI блок */}
        <Row gutter={16} style={{ marginBottom: 12 }}>
          <Col xs={6}>
            <Statistic
              title="Основная"
              value={formatMln(kpis.ncfOperating)}
              suffix="млн"
              valueStyle={{ fontSize: 15, fontWeight: 600, color: '#1890ff' }}
            />
          </Col>
          <Col xs={6}>
            <Statistic
              title="Инвестиционная"
              value={formatMln(kpis.ncfInvesting)}
              suffix="млн"
              valueStyle={{ fontSize: 15, fontWeight: 600, color: '#52c41a' }}
            />
          </Col>
          <Col xs={6}>
            <Statistic
              title="Финансовая"
              value={formatMln(kpis.ncfFinancing)}
              suffix="млн"
              valueStyle={{ fontSize: 15, fontWeight: 600, color: '#fa8c16' }}
            />
          </Col>
          <Col xs={6}>
            <Statistic
              title="Итого ЧДП"
              value={formatMln(kpis.ncfTotal)}
              suffix="млн"
              valueStyle={{ fontSize: 18, fontWeight: 700, color: totalColor }}
            />
          </Col>
        </Row>
        {/* Легенда */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 8, flexWrap: 'wrap' }}>
          {LEGEND_ITEMS.map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              {item.isLine ? (
                <span style={{ width: 16, height: 3, background: item.color, display: 'inline-block', borderRadius: 1 }} />
              ) : (
                <span style={{ width: 12, height: 10, background: item.color, opacity: 0.75, display: 'inline-block', borderRadius: 2 }} />
              )}
              <span style={{ color: '#595959' }}>{item.label}</span>
            </div>
          ))}
        </div>
        <DualAxes {...config} height={320} />
      </Card>
    </div>
  );
};
