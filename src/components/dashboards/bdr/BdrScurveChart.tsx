import { type FC, useMemo, useRef, useState } from 'react';
import { Card, Radio, Space, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Mix } from '@ant-design/charts';
import type { IBdrDashboardData } from '../../../types/dashboard';
import { ShareChartButton } from '../../common/ShareChartButton';

type ChartMode = 'monthly' | 'cumulative';
type VatMode = 'without' | 'with';

interface IProps {
  data: IBdrDashboardData;
}

const HELP_TEXT = `На графике вы всегда увидите две линии: План (базовый график производства работ) и Факт (реальное выполнение).

1. Анализ «Коридора» (отставание или опережение)
• Факт ниже Плана: Классическое отставание. Чем шире разрыв, тем больше объём работ, который нужно «нагонять».
• Факт выше Плана: Опережение графика. Вы работаете быстрее и, скорее всего, раньше получите бонусы за ввод.

2. Анализ Угла Наклона (темп)
• Крутой наклон факта: Высокая скорость. Если догоняете план — мобилизация ресурсов прошла успешно.
• Пологий наклон (плато): Стройка «встала». Сигнал о критических проблемах (нет материалов, задержка финансирования, выход субподрядчика).

3. Горизонтальное смещение (прогноз задержки)
Проведите горизонтальную линию от текущей точки Факта до пересечения с линией Плана. Расстояние по оси X покажет реальный срок задержки проекта. Например, текущий объём работ должен был быть выполнен 2 месяца назад — это математический прогноз даты окончания стройки.`;

export const BdrScurveChart: FC<IProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ChartMode>('cumulative');
  const [vatMode, setVatMode] = useState<VatMode>('without');

  const isWithVat = vatMode === 'with';

  const revenueByMonth = isWithVat ? data.revenueByMonthWithVat : data.revenueByMonth;
  const scurve = isWithVat ? data.scurveWithVat : data.scurve;

  const { monthlyRedArea, monthlyGreenArea, cumRedArea, cumGreenArea } = useMemo(() => {
    const raw = revenueByMonth;
    const months: string[] = [];
    const planMap = new Map<string, number>();
    const factMap = new Map<string, number>();

    for (const pt of raw) {
      if (pt.type === 'План') {
        planMap.set(pt.month, pt.value);
        months.push(pt.month);
      } else {
        factMap.set(pt.month, pt.value);
      }
    }

    const monthlyRedArea = months.map(m => {
      const plan = planMap.get(m) ?? 0;
      const fact = factMap.get(m) ?? 0;
      return { month: m, upper: plan, lower: Math.min(plan, fact) };
    });

    const monthlyGreenArea = months.map(m => {
      const plan = planMap.get(m) ?? 0;
      const fact = factMap.get(m) ?? 0;
      return { month: m, upper: fact, lower: Math.min(plan, fact) };
    });

    const cumRedArea = months.map(m => {
      const cumPlanVal = scurve.find(d => d.month === m && d.type === 'План')?.value ?? 0;
      const cumFactVal = scurve.find(d => d.month === m && d.type === 'Факт')?.value ?? 0;
      return { month: m, upper: cumPlanVal, lower: Math.min(cumPlanVal, cumFactVal) };
    });

    const cumGreenArea = months.map(m => {
      const cumPlanVal = scurve.find(d => d.month === m && d.type === 'План')?.value ?? 0;
      const cumFactVal = scurve.find(d => d.month === m && d.type === 'Факт')?.value ?? 0;
      return { month: m, upper: cumFactVal, lower: Math.min(cumPlanVal, cumFactVal) };
    });

    return { monthlyRedArea, monthlyGreenArea, cumRedArea, cumGreenArea };
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

  const lineBase = {
    type: 'line' as const,
    xField: 'month',
    yField: 'value',
    colorField: 'type',
    scale: {
      y: { key: 'yShared', independent: false },
      color: {
        domain: ['План', 'Факт'],
        range: ['#1890ff', '#52c41a'],
      },
    },
    axis: {
      y: {
        labelFormatter: (v: number) => (v / 1000000).toFixed(1) + 'М',
      },
    },
    style: { lineWidth: 2 },
    tooltip: {
      items: [
        {
          channel: 'y',
          valueFormatter: (v: number) =>
            v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽',
        },
      ],
    },
  };

  const monthlyConfig = {
    children: [
      { type: 'area' as const, data: monthlyRedArea, ...areaBase, style: { fill: '#ff4d4f', fillOpacity: 0.25, stroke: 'transparent' } },
      { type: 'area' as const, data: monthlyGreenArea, ...areaBase, style: { fill: '#52c41a', fillOpacity: 0.25, stroke: 'transparent' } },
      { ...lineBase, data: revenueByMonth },
    ],
    interaction: { tooltip: { shared: true } },
  };

  const cumulativeConfig = {
    children: [
      { type: 'area' as const, data: cumRedArea, ...areaBase, style: { fill: '#ff4d4f', fillOpacity: 0.25, stroke: 'transparent' } },
      { type: 'area' as const, data: cumGreenArea, ...areaBase, style: { fill: '#52c41a', fillOpacity: 0.25, stroke: 'transparent' } },
      { ...lineBase, data: scurve },
    ],
    interaction: { tooltip: { shared: true } },
  };

  const titleExtra = (
    <Space size="small" wrap>
      <Radio.Group
        value={vatMode}
        onChange={e => setVatMode(e.target.value)}
        size="small"
        optionType="button"
        buttonStyle="solid"
      >
        <Radio.Button value="without">Без НДС</Radio.Button>
        <Radio.Button value="with">С НДС</Radio.Button>
      </Radio.Group>
      <Radio.Group
        value={mode}
        onChange={e => setMode(e.target.value)}
        size="small"
        optionType="button"
        buttonStyle="solid"
      >
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
        {mode === 'monthly' ? (
          <Mix {...monthlyConfig} height={300} />
        ) : (
          <Mix {...cumulativeConfig} height={300} />
        )}
      </Card>
    </div>
  );
};
