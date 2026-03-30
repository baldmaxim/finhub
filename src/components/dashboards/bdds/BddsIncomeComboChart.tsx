import { type FC, useMemo, useRef } from 'react';
import { Card, Tooltip, Statistic, Row, Col } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { DualAxes } from '@ant-design/charts';
import type { IBddsDashboardData, IMonthDataPoint } from '../../../types/dashboard';
import { ShareChartButton } from '../../common/ShareChartButton';

interface IProps {
  data: IBddsDashboardData;
}

const HELP_TEXT = `Поступления: факт vs план.

• Столбцы — фактические поступления (итого).
• Пунктирная линия — плановые поступления.

Столбцы обрываются на текущем месяце. Линия плана продолжается до конца периода.`;

const formatMln = (v: number): string =>
  (v / 1_000_000).toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const axisFormatter = (v: number): string => {
  const mln = v / 1_000_000;
  if (mln % 1 === 0) {
    return mln.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
  }
  return mln.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
};

export const BddsIncomeComboChart: FC<IProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const hasData = data.factIncomeLine.length > 0 || data.planIncomeLine.length > 0;

  if (!hasData) return null;

  const { months, lastFactMonth, factBars, planLine } = useMemo(() => {
    const monthOrder: string[] = [];
    const seen = new Set<string>();

    for (const pt of data.planIncomeLine) {
      if (!seen.has(pt.month)) { seen.add(pt.month); monthOrder.push(pt.month); }
    }
    for (const pt of data.factIncomeLine) {
      if (!seen.has(pt.month)) { seen.add(pt.month); monthOrder.push(pt.month); }
    }

    let lastFact = '';
    for (const pt of data.factIncomeLine) {
      if (pt.value > 0) lastFact = pt.month;
    }

    // Обрезаем факт до последнего ненулевого месяца
    const factBars: IMonthDataPoint[] = [];
    let reachedEnd = false;
    for (const pt of data.factIncomeLine) {
      if (reachedEnd) continue;
      factBars.push(pt);
      if (pt.month === lastFact) reachedEnd = true;
    }

    return { months: monthOrder, lastFactMonth: lastFact, factBars, planLine: data.planIncomeLine };
  }, [data.factIncomeLine, data.planIncomeLine]);

  // KPI — до последнего фактического месяца
  const kpi = useMemo(() => {
    let planTotal = 0, factTotal = 0;
    let reachedEnd = false;
    for (const m of months) {
      if (reachedEnd) continue;
      const planPt = data.planIncomeLine.find((p) => p.month === m);
      const factPt = data.factIncomeLine.find((p) => p.month === m);
      planTotal += planPt?.value ?? 0;
      factTotal += factPt?.value ?? 0;
      if (m === lastFactMonth) reachedEnd = true;
    }
    return { plan: planTotal, fact: factTotal, delta: factTotal - planTotal };
  }, [months, lastFactMonth, data.planIncomeLine, data.factIncomeLine]);

  // Tooltip map
  const tooltipMap = useMemo(() => {
    const map = new Map<string, { plan: number; fact: number }>();
    for (const m of months) {
      const planPt = data.planIncomeLine.find((p) => p.month === m);
      const factPt = data.factIncomeLine.find((p) => p.month === m);
      map.set(m, {
        plan: planPt?.value ?? 0,
        fact: factPt?.value ?? 0,
      });
    }
    return map;
  }, [months, data.planIncomeLine, data.factIncomeLine]);

  const config = {
    xField: 'month',
    interaction: {
      tooltip: {
        render: (_: unknown, { items }: { items: Array<{ value: unknown }> }) => {
          const firstItem = items[0] as { data?: Record<string, unknown> };
          const monthKey = (firstItem?.data?.month as string) || '';
          const info = tooltipMap.get(monthKey);
          if (!info) return '';
          const pct = info.plan > 0 ? ((info.fact / info.plan) * 100).toFixed(0) : '—';
          const deltaColor = info.fact >= info.plan ? '#52c41a' : '#ff4d4f';
          return `<div style="padding:4px 0;font-size:13px;line-height:1.6">
            <div style="font-weight:600;margin-bottom:4px">${monthKey}</div>
            <div>План: <b>${formatMln(info.plan)} млн</b></div>
            <div>Факт: <b>${formatMln(info.fact)} млн</b></div>
            <div>Выполнение: <span style="color:${deltaColor};font-weight:600">${pct}%</span></div>
          </div>`;
        },
      },
    },
    children: [
      // Столбцы факта — единый синий столбец
      {
        data: factBars,
        type: 'interval' as const,
        yField: 'value',
        scale: {
          x: { domain: months },
          y: { key: 'shared' },
        },
        style: { maxWidth: 36, fill: '#1890ff', fillOpacity: 0.85 },
        axis: {
          x: {
            title: false,
            label: true,
            labelAutoRotate: true,
            labelAutoHide: false,
            labelAutoEllipsis: false,
            style: { labelFontSize: 11 },
          },
          y: {
            title: 'Сумма (млн руб.)',
            titleFontSize: 11,
            labelFormatter: axisFormatter,
          },
        },
        legend: false,
        tooltip: {
          items: [
            (d: IMonthDataPoint) => ({
              name: 'Факт',
              value: formatMln(d.value) + ' млн',
              color: '#1890ff',
            }),
          ],
        },
      },
      // Линия плана — та же ось (shared key)
      {
        data: planLine,
        type: 'line' as const,
        yField: 'value',
        colorField: 'type',
        scale: {
          x: { domain: months },
          y: { key: 'shared' },
          color: {
            domain: ['План'],
            range: ['#595959'],
          },
        },
        style: {
          lineWidth: 2.5,
          lineDash: [6, 4],
        },
        axis: false,
        legend: false,
        tooltip: {
          items: [
            (d: IMonthDataPoint) => ({
              name: 'План',
              value: formatMln(d.value) + ' млн',
              color: '#595959',
            }),
          ],
        },
      },
    ],
  };

  const NEAR_ZERO_THRESHOLD = 1;
  const deltaColor = Math.abs(kpi.delta) <= NEAR_ZERO_THRESHOLD
    ? '#8c8c8c'
    : kpi.delta > 0 ? '#52c41a' : '#ff4d4f';

  const title = (
    <span>
      Поступления: план vs факт{' '}
      <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{HELP_TEXT}</span>} overlayStyle={{ maxWidth: 480 }}>
        <InfoCircleOutlined className="bdr-bubble-help-icon" />
      </Tooltip>
    </span>
  );

  return (
    <div ref={chartRef}>
      <Card title={title} extra={<ShareChartButton chartRef={chartRef} title="Поступления: план vs факт" />} size="small" className="dashboard-chart-card">
        {/* KPI блок */}
        <Row gutter={16} style={{ marginBottom: 12 }}>
          <Col xs={8}>
            <Statistic
              title="План поступлений"
              value={formatMln(kpi.plan)}
              suffix="млн руб."
              valueStyle={{ fontSize: 16, fontWeight: 600, color: '#595959' }}
            />
          </Col>
          <Col xs={8}>
            <Statistic
              title="Факт поступлений"
              value={formatMln(kpi.fact)}
              suffix="млн руб."
              valueStyle={{ fontSize: 16, fontWeight: 600, color: '#1890ff' }}
            />
          </Col>
          <Col xs={8}>
            <Statistic
              title="Отклонение"
              value={(kpi.delta >= 0 ? '+' : '') + formatMln(kpi.delta)}
              suffix="млн руб."
              valueStyle={{ fontSize: 16, fontWeight: 600, color: deltaColor }}
            />
          </Col>
        </Row>
        {/* Легенда */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <span style={{ width: 12, height: 10, background: '#1890ff', opacity: 0.85, display: 'inline-block', borderRadius: 2 }} />
            <span style={{ color: '#595959' }}>Факт</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <svg width="20" height="10"><line x1="0" y1="5" x2="20" y2="5" stroke="#595959" strokeWidth="2" strokeDasharray="4 3" /></svg>
            <span style={{ color: '#595959' }}>План</span>
          </div>
        </div>
        <DualAxes {...config} height={350} />
      </Card>
    </div>
  );
};
