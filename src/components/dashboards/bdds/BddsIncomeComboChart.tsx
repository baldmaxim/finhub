import { type FC, useMemo, useRef } from 'react';
import { Card, Tooltip, Statistic, Row, Col } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { DualAxes } from '@ant-design/charts';
import type { IBddsDashboardData, IProjectMonthDataPoint } from '../../../types/dashboard';
import { ShareChartButton } from '../../common/ShareChartButton';

interface IProps {
  data: IBddsDashboardData;
}

const HELP_TEXT = `Поступления: факт vs план.

• Столбцы — фактические поступления с разбивкой по проектам (stacked).
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

// Палитра оттенков синего/голубого для проектов
const BLUE_PALETTE = [
  '#1890ff', '#0050b3', '#40a9ff', '#003a8c', '#69c0ff',
  '#002766', '#91d5ff', '#0958d9', '#4096ff', '#1677ff',
  '#bae0ff', '#1d39c4', '#597ef7', '#2f54eb', '#85a5ff',
];

export const BddsIncomeComboChart: FC<IProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const hasData = data.factIncomeLine.length > 0 || data.planIncomeLine.length > 0;

  if (!hasData) return null;

  const { months, lastFactMonth, factBars, planLine, projectNames, projectColorMap } = useMemo(() => {
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

    // Собираем уникальные имена проектов
    const projectNamesSet = new Set<string>();
    for (const pt of data.factIncomeByProject) {
      projectNamesSet.add(pt.project);
    }
    const projectNames = Array.from(projectNamesSet).sort();

    // Цвета будут назначены после финализации списка проектов (см. ниже)

    // Факт по проектам, обрезанный до последнего ненулевого месяца
    // Если есть факт из factIncomeLine, но нет разбивки — записываем как «Прочие»
    const factByMonthMap = new Map<string, number>();
    for (const pt of data.factIncomeLine) {
      factByMonthMap.set(pt.month, pt.value);
    }

    const OTHER_LABEL = 'Прочие';
    const factBars: IProjectMonthDataPoint[] = [];
    let reachedEnd = false;
    for (const m of monthOrder) {
      if (reachedEnd) continue;
      const monthEntries = data.factIncomeByProject.filter((pt) => pt.month === m && pt.value !== 0);
      const projectTotal = monthEntries.reduce((s, e) => s + e.value, 0);
      const totalFact = factByMonthMap.get(m) ?? 0;

      if (monthEntries.length > 0) {
        for (const entry of monthEntries) {
          factBars.push(entry);
        }
        // Если есть разница между общим фактом и суммой по проектам
        const diff = totalFact - projectTotal;
        if (Math.abs(diff) > 1) {
          factBars.push({ month: m, value: diff, project: OTHER_LABEL });
          if (!projectNamesSet.has(OTHER_LABEL)) projectNamesSet.add(OTHER_LABEL);
        }
      } else if (totalFact > 0) {
        // Нет разбивки — весь факт как «Прочие»
        factBars.push({ month: m, value: totalFact, project: OTHER_LABEL });
        if (!projectNamesSet.has(OTHER_LABEL)) projectNamesSet.add(OTHER_LABEL);
      } else {
        factBars.push({ month: m, value: 0, project: projectNames[0] || OTHER_LABEL });
      }
      if (m === lastFact) reachedEnd = true;
    }

    // Пересобираем projectNames после возможного добавления «Прочие»
    const finalProjectNames = Array.from(projectNamesSet).sort();

    // Маппинг проект -> цвет
    const projectColorMap = new Map<string, string>();
    finalProjectNames.forEach((name, i) => {
      projectColorMap.set(name, BLUE_PALETTE[i % BLUE_PALETTE.length]);
    });

    return {
      months: monthOrder,
      lastFactMonth: lastFact,
      factBars,
      planLine: data.planIncomeLine,
      projectNames: finalProjectNames,
      projectColorMap,
    };
  }, [data.factIncomeLine, data.planIncomeLine, data.factIncomeByProject]);

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
    const map = new Map<string, { plan: number; fact: number; byProject: Array<{ project: string; value: number }> }>();
    for (const m of months) {
      const planPt = data.planIncomeLine.find((p) => p.month === m);
      const factPt = data.factIncomeLine.find((p) => p.month === m);
      const byProject = data.factIncomeByProject
        .filter((p) => p.month === m && p.value !== 0)
        .sort((a, b) => b.value - a.value);
      map.set(m, {
        plan: planPt?.value ?? 0,
        fact: factPt?.value ?? 0,
        byProject,
      });
    }
    return map;
  }, [months, data.planIncomeLine, data.factIncomeLine, data.factIncomeByProject]);

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
          const projectRows = info.byProject
            .map((p) => {
              const color = projectColorMap.get(p.project) || '#1890ff';
              return `<div style="display:flex;align-items:center;gap:4px">
                <span style="width:8px;height:8px;background:${color};border-radius:1px;display:inline-block;border:1px solid #fff"></span>
                <span>${p.project}: <b>${formatMln(p.value)} млн</b></span>
              </div>`;
            })
            .join('');
          return `<div style="padding:4px 0;font-size:13px;line-height:1.6">
            <div style="font-weight:600;margin-bottom:4px">${monthKey}</div>
            <div>План: <b>${formatMln(info.plan)} млн</b></div>
            <div>Факт: <b>${formatMln(info.fact)} млн</b></div>
            <div>Выполнение: <span style="color:${deltaColor};font-weight:600">${pct}%</span></div>
            ${projectRows ? `<div style="margin-top:4px;border-top:1px solid #f0f0f0;padding-top:4px">${projectRows}</div>` : ''}
          </div>`;
        },
      },
    },
    children: [
      // Stacked столбцы факта по проектам
      {
        data: factBars,
        type: 'interval' as const,
        yField: 'value',
        colorField: 'project',
        stack: true,
        scale: {
          x: { domain: months },
          y: { key: 'shared' },
          color: {
            domain: projectNames,
            range: projectNames.map((name) => projectColorMap.get(name) || '#1890ff'),
          },
        },
        style: {
          maxWidth: 36,
          stroke: '#ffffff',
          lineWidth: 1,
          fill: (datum: { project?: string }) => {
            return projectColorMap.get(datum.project || '') || '#1890ff';
          },
        },
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
            (d: IProjectMonthDataPoint) => ({
              name: d.project,
              value: formatMln(d.value) + ' млн',
              color: projectColorMap.get(d.project) || '#1890ff',
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
            (d: { month: string; value: number; type: string }) => ({
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
        {/* Легенда: проекты + план */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 8, flexWrap: 'wrap' }}>
          {projectNames.map((name) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <span style={{
                width: 12, height: 10,
                background: projectColorMap.get(name) || '#1890ff',
                display: 'inline-block', borderRadius: 2,
                border: '1px solid #fff',
                boxShadow: '0 0 0 0.5px rgba(0,0,0,0.15)',
              }} />
              <span style={{ color: '#595959' }}>{name}</span>
            </div>
          ))}
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
