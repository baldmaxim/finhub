import { type FC, useMemo, useRef, useState } from 'react';
import { Card, Radio, Space, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Mix } from '@ant-design/charts';
import type { IBdrDashboardData, IMonthDataPoint } from '../../../types/dashboard';
import { ShareChartButton } from '../../common/ShareChartButton';

type ChartMode = 'monthly' | 'cumulative';
type VatMode = 'without' | 'with';

interface IProps {
  data: IBdrDashboardData;
}

const HELP_TEXT = `На графике три линии: План (базовый график), Факт (реальное выполнение) и Прогноз (экстраполяция тренда).

1. Анализ «Коридора» (отставание или опережение)
• Факт ниже Плана: Классическое отставание. Чем шире разрыв, тем больше объём работ, который нужно «нагонять».
• Факт выше Плана: Опережение графика.

2. Анализ Угла Наклона (темп)
• Крутой наклон факта: Высокая скорость.
• Пологий наклон (плато): Стройка «встала».

3. Прогнозная линия
Пунктирная линия «Прогноз» экстраполирует текущий тренд факта до конца проекта. Если прогноз ниже плана — ожидается отставание по срокам.`;

const TREND_WINDOW = 3;

const formatMln = (v: number): string => {
  const mln = v / 1_000_000;
  return mln >= 1 ? Math.round(mln).toLocaleString('ru-RU') : mln.toFixed(1);
};

const formatRub = (v: number): string =>
  v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';

export const BdrScurveChart: FC<IProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ChartMode>('cumulative');
  const [vatMode, setVatMode] = useState<VatMode>('without');

  const isWithVat = vatMode === 'with';
  const revenueByMonth = isWithVat ? data.revenueByMonthWithVat : data.revenueByMonth;
  const scurve = isWithVat ? data.scurveWithVat : data.scurve;

  const chartData = useMemo(() => {
    const months: string[] = [];
    const planMap = new Map<string, number>();
    const factMap = new Map<string, number>();
    const cumPlanMap = new Map<string, number>();
    const cumFactMap = new Map<string, number>();

    for (const pt of revenueByMonth) {
      if (pt.type === 'План') {
        planMap.set(pt.month, pt.value);
        if (!months.includes(pt.month)) months.push(pt.month);
      } else {
        factMap.set(pt.month, pt.value);
      }
    }
    for (const pt of scurve) {
      if (pt.type === 'План') cumPlanMap.set(pt.month, pt.value);
      else cumFactMap.set(pt.month, pt.value);
    }

    // Текущий месяц — последний с ненулевым фактом
    let currentIdx = 0;
    for (let i = months.length - 1; i >= 0; i--) {
      if ((factMap.get(months[i]) ?? 0) > 0) { currentIdx = i; break; }
    }
    const currentMonth = months[currentIdx];

    // Средний месячный факт за последние N месяцев (для прогноза)
    const recentStart = Math.max(0, currentIdx - TREND_WINDOW + 1);
    const recentFacts = months.slice(recentStart, currentIdx + 1).map(m => factMap.get(m) ?? 0);
    const avgMonthly = recentFacts.length > 0
      ? recentFacts.reduce((a, b) => a + b, 0) / recentFacts.length : 0;

    // --- Помесячные данные ---
    const monthlyPlanLine = months.map(m => ({ month: m, value: planMap.get(m) ?? 0, type: 'План' }));
    const monthlyFactLine = months.slice(0, currentIdx + 1)
      .map(m => ({ month: m, value: factMap.get(m) ?? 0, type: 'Факт' }));

    const monthlyForecastLine: IMonthDataPoint[] = [
      { month: currentMonth, value: factMap.get(currentMonth) ?? 0, type: 'Прогноз' },
    ];
    for (let i = currentIdx + 1; i < months.length; i++) {
      monthlyForecastLine.push({ month: months[i], value: avgMonthly, type: 'Прогноз' });
    }

    // --- Кумулятивные данные ---
    const cumPlanLine = months.map(m => ({ month: m, value: cumPlanMap.get(m) ?? 0, type: 'План' }));
    const cumFactLine = months.slice(0, currentIdx + 1)
      .map(m => ({ month: m, value: cumFactMap.get(m) ?? 0, type: 'Факт' }));

    const lastCumFact = cumFactMap.get(currentMonth) ?? 0;
    const cumForecastLine: IMonthDataPoint[] = [
      { month: currentMonth, value: lastCumFact, type: 'Прогноз' },
    ];
    let cumVal = lastCumFact;
    for (let i = currentIdx + 1; i < months.length; i++) {
      cumVal += avgMonthly;
      cumForecastLine.push({ month: months[i], value: cumVal, type: 'Прогноз' });
    }

    // --- Области отклонений (только до текущего месяца) ---
    const active = months.slice(0, currentIdx + 1);

    const monthlyRedArea = active.map(m => {
      const plan = planMap.get(m) ?? 0;
      const fact = factMap.get(m) ?? 0;
      return { month: m, upper: plan, lower: Math.min(plan, fact) };
    });
    const monthlyGreenArea = active.map(m => {
      const plan = planMap.get(m) ?? 0;
      const fact = factMap.get(m) ?? 0;
      return { month: m, upper: fact, lower: Math.min(plan, fact) };
    });

    const cumRedArea = active.map(m => {
      const cp = cumPlanMap.get(m) ?? 0;
      const cf = cumFactMap.get(m) ?? 0;
      return { month: m, upper: cp, lower: Math.min(cp, cf) };
    });
    const cumGreenArea = active.map(m => {
      const cp = cumPlanMap.get(m) ?? 0;
      const cf = cumFactMap.get(m) ?? 0;
      return { month: m, upper: cf, lower: Math.min(cp, cf) };
    });

    // KPI на текущую дату
    const planAtCurrent = cumPlanMap.get(currentMonth) ?? 0;
    const factAtCurrent = cumFactMap.get(currentMonth) ?? 0;
    const delta = factAtCurrent - planAtCurrent;
    const deltaPct = planAtCurrent ? (delta / planAtCurrent) * 100 : 0;

    return {
      months, currentMonth, currentIdx,
      monthlyPlanLine, monthlyFactLine, monthlyForecastLine,
      cumPlanLine, cumFactLine, cumForecastLine,
      monthlyRedArea, monthlyGreenArea,
      cumRedArea, cumGreenArea,
      kpi: { planAtCurrent, factAtCurrent, delta, deltaPct },
    };
  }, [revenueByMonth, scurve]);

  const areaBase = {
    xField: 'month',
    yField: 'upper',
    y1Field: 'lower',
    scale: { y: { key: 'yShared', independent: false } },
    tooltip: false,
    axis: false,
    legend: false,
  };

  const axisConfig = {
    x: {
      labelAutoRotate: false,
      label: {
        style: { fontSize: 11 },
        transform: [{ type: 'rotate', angle: -45 }],
      },
      tickFilter: (_d: string, i: number) => {
        const total = chartData.months.length;
        if (total <= 12) return true;
        if (total <= 24) return i % 2 === 0;
        return i % 3 === 0;
      },
    },
    y: {
      title: 'Сумма (млн руб.)',
      labelFormatter: (v: number) => formatMln(v),
    },
  };

  const buildLineChild = (lineData: IMonthDataPoint[], types: string[], colors: string[]) => ({
    type: 'line' as const,
    data: lineData,
    xField: 'month',
    yField: 'value',
    colorField: 'type',
    scale: {
      y: { key: 'yShared', independent: false },
      color: { domain: types, range: colors },
    },
    axis: axisConfig,
    style: { lineWidth: 3 },
    tooltip: {
      items: [{
        channel: 'y',
        valueFormatter: formatRub,
      }],
    },
  });

  const buildForecastChild = (forecastData: IMonthDataPoint[]) => ({
    type: 'line' as const,
    data: forecastData,
    xField: 'month',
    yField: 'value',
    colorField: 'type',
    scale: {
      y: { key: 'yShared', independent: false },
      color: { domain: ['Прогноз'], range: ['#faad14'] },
    },
    style: { lineWidth: 2, lineDash: [6, 4] },
    axis: false,
    legend: false,
    tooltip: {
      items: [{
        channel: 'y',
        valueFormatter: formatRub,
      }],
    },
  });

  const buildTodayLine = () => ({
    type: 'lineX' as const,
    data: [chartData.currentMonth],
    style: { stroke: '#8c8c8c', lineDash: [4, 4], lineWidth: 1 },
    axis: false,
    legend: false,
    tooltip: false,
    labels: [{
      text: 'Сегодня',
      position: 'top',
      dy: -4,
      style: { fontSize: 10, fill: '#8c8c8c' },
    }],
  });

  const monthlyConfig = {
    children: [
      { type: 'area' as const, data: chartData.monthlyRedArea, ...areaBase,
        style: { fill: '#ff4d4f', fillOpacity: 0.2, stroke: 'transparent' } },
      { type: 'area' as const, data: chartData.monthlyGreenArea, ...areaBase,
        style: { fill: '#52c41a', fillOpacity: 0.2, stroke: 'transparent' } },
      buildLineChild(
        [...chartData.monthlyPlanLine, ...chartData.monthlyFactLine],
        ['План', 'Факт'], ['#1890ff', '#52c41a'],
      ),
      buildForecastChild(chartData.monthlyForecastLine),
      buildTodayLine(),
    ],
    interaction: {
      tooltip: {
        shared: true,
        render: (_: unknown, { items }: { items: Array<{ name: string; value: string; color: string }> }) => {
          const plan = items.find(i => i.name === 'План');
          const fact = items.find(i => i.name === 'Факт');
          const forecast = items.find(i => i.name === 'Прогноз');
          let html = '<div style="padding:4px 8px;font-size:12px">';
          if (plan) html += `<div style="color:${plan.color}">План: ${plan.value}</div>`;
          if (fact) html += `<div style="color:${fact.color}">Факт: ${fact.value}</div>`;
          if (forecast) html += `<div style="color:${forecast.color}">Прогноз: ${forecast.value}</div>`;
          if (plan && fact) {
            const pv = parseFloat(plan.value.replace(/\s/g, '').replace('₽', ''));
            const fv = parseFloat(fact.value.replace(/\s/g, '').replace('₽', ''));
            const d = fv - pv;
            const color = d >= 0 ? '#52c41a' : '#ff4d4f';
            const sign = d >= 0 ? '+' : '';
            html += `<div style="color:${color};font-weight:600">Δ: ${sign}${formatRub(d)}</div>`;
          }
          html += '</div>';
          return html;
        },
      },
    },
  };

  const cumulativeConfig = {
    children: [
      { type: 'area' as const, data: chartData.cumRedArea, ...areaBase,
        style: { fill: '#ff4d4f', fillOpacity: 0.2, stroke: 'transparent' } },
      { type: 'area' as const, data: chartData.cumGreenArea, ...areaBase,
        style: { fill: '#52c41a', fillOpacity: 0.2, stroke: 'transparent' } },
      buildLineChild(
        [...chartData.cumPlanLine, ...chartData.cumFactLine],
        ['План', 'Факт'], ['#1890ff', '#52c41a'],
      ),
      buildForecastChild(chartData.cumForecastLine),
      buildTodayLine(),
    ],
    interaction: {
      tooltip: {
        shared: true,
        render: (_: unknown, { items }: { items: Array<{ name: string; value: string; color: string }> }) => {
          const plan = items.find(i => i.name === 'План');
          const fact = items.find(i => i.name === 'Факт');
          const forecast = items.find(i => i.name === 'Прогноз');
          let html = '<div style="padding:4px 8px;font-size:12px">';
          if (plan) html += `<div style="color:${plan.color}">План: ${plan.value}</div>`;
          if (fact) html += `<div style="color:${fact.color}">Факт: ${fact.value}</div>`;
          if (forecast) html += `<div style="color:${forecast.color}">Прогноз: ${forecast.value}</div>`;
          if (plan && fact) {
            const pv = parseFloat(plan.value.replace(/\s/g, '').replace('₽', ''));
            const fv = parseFloat(fact.value.replace(/\s/g, '').replace('₽', ''));
            const d = fv - pv;
            const color = d >= 0 ? '#52c41a' : '#ff4d4f';
            const sign = d >= 0 ? '+' : '';
            html += `<div style="color:${color};font-weight:600">Δ: ${sign}${formatRub(d)}</div>`;
          }
          html += '</div>';
          return html;
        },
      },
    },
  };

  const { kpi } = chartData;
  const deltaColor = kpi.delta >= 0 ? '#52c41a' : '#ff4d4f';
  const deltaSign = kpi.delta >= 0 ? '+' : '';

  const titleExtra = (
    <Space size="small" wrap>
      <Radio.Group value={vatMode} onChange={e => setVatMode(e.target.value)}
        size="small" optionType="button" buttonStyle="solid">
        <Radio.Button value="without">Без НДС</Radio.Button>
        <Radio.Button value="with">С НДС</Radio.Button>
      </Radio.Group>
      <Radio.Group value={mode} onChange={e => setMode(e.target.value)}
        size="small" optionType="button" buttonStyle="solid">
        <Radio.Button value="monthly">Помесячно</Radio.Button>
        <Radio.Button value="cumulative">Нарастающий итог</Radio.Button>
      </Radio.Group>
      <ShareChartButton chartRef={chartRef} title="S-кривая план vs факт" />
    </Space>
  );

  const title = (
    <span>
      S-кривая: план vs факт{' '}
      <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{HELP_TEXT}</span>} overlayStyle={{ maxWidth: 480 }}>
        <InfoCircleOutlined className="bdr-bubble-help-icon" />
      </Tooltip>
    </span>
  );

  return (
    <div ref={chartRef}>
      <Card title={title} extra={titleExtra} size="small" className="dashboard-chart-card">
        <div className="scurve-kpi-row">
          <div className="scurve-kpi-item">
            <span className="scurve-kpi-label">План на сегодня</span>
            <span className="scurve-kpi-value">{formatMln(kpi.planAtCurrent)} млн</span>
          </div>
          <div className="scurve-kpi-item">
            <span className="scurve-kpi-label">Факт на сегодня</span>
            <span className="scurve-kpi-value">{formatMln(kpi.factAtCurrent)} млн</span>
          </div>
          <div className="scurve-kpi-item">
            <span className="scurve-kpi-label">Отклонение (Δ)</span>
            <span className="scurve-kpi-value" style={{ color: deltaColor }}>
              {deltaSign}{formatMln(kpi.delta)} млн ({deltaSign}{kpi.deltaPct.toFixed(1)}%)
            </span>
          </div>
        </div>
        {mode === 'monthly' ? (
          <Mix {...monthlyConfig} height={320} />
        ) : (
          <Mix {...cumulativeConfig} height={320} />
        )}
      </Card>
    </div>
  );
};
