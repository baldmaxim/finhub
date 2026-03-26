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

const HELP_TEXT = `На графике три линии: План (контрактный график), Факт (реальное выполнение) и Прогноз (экстраполяция тренда).

1. Анализ «Коридора»
• Факт ниже Плана — отставание. Чем шире разрыв, тем больше объём для нагона.
• Факт выше Плана — опережение графика.

2. Прогнозная линия
Зелёный пунктир экстраполирует текущий темп до 100% бюджета. Форма повторяет S-кривую оставшегося плана. Если прогноз уходит правее «Плановое завершение» — ожидается задержка.`;

const TREND_WINDOW = 3;
const MAX_FORECAST_MONTHS = 36;
const MONTH_SHORTS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

const formatMln = (v: number): string => {
  const mln = v / 1_000_000;
  return mln >= 1 ? Math.round(mln).toLocaleString('ru-RU') : mln.toFixed(1);
};

const formatRub = (v: number): string =>
  v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';

const generateNextMonths = (lastLabel: string, count: number): string[] => {
  const parts = lastLabel.split(' ');
  const isMulti = parts.length === 2;
  let m = MONTH_SHORTS.indexOf(parts[0]);
  let y = isMulti ? parseInt(parts[1]) : 0;
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    m++;
    if (m >= 12) { m = 0; y++; }
    result.push(isMulti ? `${MONTH_SHORTS[m]} ${y}` : MONTH_SHORTS[m]);
  }
  return result;
};

/** Линейная интерполяция массива source в targetLen точек */
const resampleWeights = (source: number[], targetLen: number): number[] => {
  if (targetLen <= 0) return [];
  if (source.length === 0) return new Array(targetLen).fill(1);
  if (source.length === 1) return new Array(targetLen).fill(source[0]);
  if (source.length === targetLen) return [...source];
  const result: number[] = [];
  for (let i = 0; i < targetLen; i++) {
    const pos = targetLen === 1 ? 0 : (i / (targetLen - 1)) * (source.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(lo + 1, source.length - 1);
    const frac = pos - lo;
    result.push(source[lo] * (1 - frac) + source[hi] * frac);
  }
  return result;
};

export const BdrScurveChart: FC<IProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ChartMode>('cumulative');
  const [vatMode, setVatMode] = useState<VatMode>('without');
  const [expanded, setExpanded] = useState(false);

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

    // Последний месяц с ненулевым планом
    let lastPlanIdx = 0;
    for (let i = months.length - 1; i >= 0; i--) {
      if ((planMap.get(months[i]) ?? 0) > 0) { lastPlanIdx = i; break; }
    }
    const lastPlanMonth = months[lastPlanIdx];

    // Средняя скорость за последние N месяцев
    const recentStart = Math.max(0, currentIdx - TREND_WINDOW + 1);
    const recentFacts = months.slice(recentStart, currentIdx + 1).map(m => factMap.get(m) ?? 0);
    const avgSpeed = recentFacts.length > 0
      ? recentFacts.reduce((a, b) => a + b, 0) / recentFacts.length : 0;

    // Итоговый план и остаток
    const totalPlan = Math.max(...Array.from(cumPlanMap.values()), 0);
    const lastCumFact = cumFactMap.get(currentMonth) ?? 0;
    const remaining = Math.max(0, totalPlan - lastCumFact);

    // Количество месяцев прогноза (с потолком)
    const forecastMonthsCount = avgSpeed > 0 && remaining > 0
      ? Math.min(Math.ceil(remaining / avgSpeed), MAX_FORECAST_MONTHS) : 0;

    // Дополнительные месяцы если прогноз выходит за данные
    const monthsAfterCurrent = months.length - currentIdx - 1;
    const extraNeeded = Math.max(0, forecastMonthsCount - monthsAfterCurrent);
    const extraLabels = extraNeeded > 0
      ? generateNextMonths(months[months.length - 1], extraNeeded) : [];
    const allMonths = [...months, ...extraLabels];

    // Веса из оставшегося плана для S-образной формы
    const planWeightsRaw: number[] = [];
    for (let i = currentIdx + 1; i <= lastPlanIdx; i++) {
      planWeightsRaw.push(planMap.get(months[i]) ?? 0);
    }
    const planWeights = planWeightsRaw.length > 0 && planWeightsRaw.some(w => w > 0)
      ? planWeightsRaw : [1];

    const resampled = forecastMonthsCount > 0
      ? resampleWeights(planWeights, forecastMonthsCount) : [];
    const weightSum = resampled.reduce((a, b) => a + b, 0);
    const scaledWeights = weightSum > 0
      ? resampled.map(w => (w / weightSum) * remaining) : [];

    // --- План (обрезан по lastPlanIdx) ---
    const monthlyPlanLine = months.slice(0, lastPlanIdx + 1)
      .map(m => ({ month: m, value: planMap.get(m) ?? 0, type: 'План' }));
    const cumPlanLine = months.slice(0, lastPlanIdx + 1)
      .map(m => ({ month: m, value: cumPlanMap.get(m) ?? 0, type: 'План' }));

    // --- Факт (обрезан по currentIdx) ---
    const monthlyFactLine = months.slice(0, currentIdx + 1)
      .map(m => ({ month: m, value: factMap.get(m) ?? 0, type: 'Факт' }));
    const cumFactLine = months.slice(0, currentIdx + 1)
      .map(m => ({ month: m, value: cumFactMap.get(m) ?? 0, type: 'Факт' }));

    // --- Прогноз (S-образный, от факта к totalPlan) ---
    const monthlyForecastLine: IMonthDataPoint[] = [];
    const cumForecastLine: IMonthDataPoint[] = [];

    if (forecastMonthsCount > 0) {
      // Стартовая точка — стыковка с фактом
      monthlyForecastLine.push({
        month: currentMonth, value: factMap.get(currentMonth) ?? 0, type: 'Прогноз',
      });
      cumForecastLine.push({ month: currentMonth, value: lastCumFact, type: 'Прогноз' });

      let cumVal = lastCumFact;
      for (let i = 0; i < forecastMonthsCount; i++) {
        const mLabel = allMonths[currentIdx + 1 + i];
        const mVal = scaledWeights[i];
        cumVal = Math.min(cumVal + mVal, totalPlan);
        monthlyForecastLine.push({ month: mLabel, value: mVal, type: 'Прогноз' });
        cumForecastLine.push({ month: mLabel, value: cumVal, type: 'Прогноз' });
      }
    }

    const forecastEndMonth = forecastMonthsCount > 0
      ? allMonths[currentIdx + forecastMonthsCount] : null;

    // --- Области отклонений (до текущего месяца) ---
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

    // KPI
    const planAtCurrent = cumPlanMap.get(currentMonth) ?? 0;
    const delta = lastCumFact - planAtCurrent;
    const deltaPct = planAtCurrent ? (delta / planAtCurrent) * 100 : 0;

    return {
      allMonths, months, currentMonth, currentIdx,
      lastPlanMonth, forecastEndMonth, totalPlan,
      monthlyPlanLine, monthlyFactLine, monthlyForecastLine,
      cumPlanLine, cumFactLine, cumForecastLine,
      monthlyRedArea, monthlyGreenArea,
      cumRedArea, cumGreenArea,
      kpi: { planAtCurrent, factAtCurrent: lastCumFact, delta, deltaPct },
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

  const totalMonths = chartData.allMonths.length;
  const tickStep = totalMonths <= 12 ? 1 : totalMonths <= 24 ? 2 : 3;

  const axisConfig = {
    x: {
      labelAutoRotate: false,
      labelTransform: totalMonths > 12 ? 'rotate(-45)' : 'rotate(0)',
      labelFormatter: (v: string, idx: number) =>
        idx % tickStep === 0 ? v : '',
    },
    y: {
      title: 'Сумма (млн руб.)',
      labelFormatter: (v: number) => formatMln(v),
    },
  };

  const buildLineChild = (
    lineData: IMonthDataPoint[], types: string[], colors: string[],
  ) => ({
    type: 'line' as const,
    data: lineData,
    xField: 'month',
    yField: 'value',
    colorField: 'type',
    scale: {
      x: { domain: chartData.allMonths },
      y: { key: 'yShared', independent: false },
      color: { domain: types, range: colors },
    },
    axis: axisConfig,
    style: { lineWidth: 3 },
    tooltip: {
      items: [{ channel: 'y' as const, valueFormatter: formatRub }],
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
      color: { domain: ['Прогноз'], range: ['#52c41a'] },
    },
    style: { lineWidth: 2, lineDash: [6, 4] },
    axis: false,
    legend: false,
    tooltip: {
      items: [{ channel: 'y' as const, valueFormatter: formatRub }],
    },
  });

  const buildMarkerLine = (month: string, label: string, color: string, offsetY = -4) => ({
    type: 'lineX' as const,
    data: [month],
    style: { stroke: color, lineDash: [4, 4], lineWidth: 1 },
    axis: false,
    legend: false,
    tooltip: false,
    labels: [{
      text: label,
      position: 'top' as const,
      dy: offsetY,
      style: { fontSize: 10, fill: color },
    }],
  });

  const tooltipRender = (_: unknown, { items }: { items: Array<{ name: string; value: string; color: string }> }) => {
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
  };

  const buildConfig = (
    planLine: IMonthDataPoint[],
    factLine: IMonthDataPoint[],
    forecastLine: IMonthDataPoint[],
    redArea: Array<{ month: string; upper: number; lower: number }>,
    greenArea: Array<{ month: string; upper: number; lower: number }>,
  ) => ({
    children: [
      { type: 'area' as const, data: redArea, ...areaBase,
        style: { fill: '#ff4d4f', fillOpacity: 0.2, stroke: 'transparent' } },
      { type: 'area' as const, data: greenArea, ...areaBase,
        style: { fill: '#52c41a', fillOpacity: 0.2, stroke: 'transparent' } },
      buildForecastChild(forecastLine),
      buildMarkerLine(chartData.currentMonth, 'Сегодня', '#8c8c8c', 4),
      buildMarkerLine(chartData.lastPlanMonth, 'Плановое завершение', '#1890ff', 18),
      ...(chartData.forecastEndMonth
        ? [buildMarkerLine(chartData.forecastEndMonth, 'Прогнозное завершение', '#52c41a', 32)]
        : []),
      buildLineChild([...planLine, ...factLine], ['План', 'Факт'], ['#1890ff', '#52c41a']),
    ],
    interaction: { tooltip: { shared: true, render: tooltipRender } },
  });

  const monthlyConfig = buildConfig(
    chartData.monthlyPlanLine, chartData.monthlyFactLine, chartData.monthlyForecastLine,
    chartData.monthlyRedArea, chartData.monthlyGreenArea,
  );
  const cumulativeConfig = buildConfig(
    chartData.cumPlanLine, chartData.cumFactLine, chartData.cumForecastLine,
    chartData.cumRedArea, chartData.cumGreenArea,
  );

  const { kpi, forecastEndMonth } = chartData;
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

  const chartHeight = expanded ? 600 : 320;

  return (
    <div ref={chartRef} className={expanded ? 'scurve-expanded' : undefined}>
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
          {forecastEndMonth && (
            <div className="scurve-kpi-item">
              <span className="scurve-kpi-label">Прогноз завершения</span>
              <span className="scurve-kpi-value" style={{
                color: forecastEndMonth !== chartData.lastPlanMonth ? '#ff4d4f' : '#52c41a',
              }}>
                {forecastEndMonth}
              </span>
            </div>
          )}
        </div>
        <div
          className="scurve-chart-area"
          onClick={() => setExpanded(prev => !prev)}
        >
          {mode === 'monthly' ? (
            <Mix {...monthlyConfig} height={chartHeight} />
          ) : (
            <Mix {...cumulativeConfig} height={chartHeight} />
          )}
        </div>
      </Card>
    </div>
  );
};
