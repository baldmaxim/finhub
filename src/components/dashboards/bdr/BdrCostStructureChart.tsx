import { type FC, useRef, useState, useMemo } from 'react';
import { Card, Tooltip, Row, Col, Statistic, Segmented } from 'antd';
import { InfoCircleOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { Column } from '@ant-design/charts';
import type { IBdrDashboardData, ICostItem } from '../../../types/dashboard';
import { ShareChartButton } from '../../common/ShareChartButton';

interface IProps {
  data: IBdrDashboardData;
  hoveredMonth?: string | null;
  onHoverMonth?: (month: string | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChartReady?: (chart: any) => void;
}

const HELP_TEXT = `1. Состав «пирога» (основные доли)
• Субподрядчики: В идеальной модели генподрядчика это самая большая часть (60–80%).
• Материалы: Прямые закупки на объект.
• ФОТ (Собственные силы): Зарплата рабочих и ИТР.
• Машины и механизмы (МиМ): Аренда техники или расходы на свой парк.

2. Как читать сигналы графика
А. Сверхвысокая доля субподряда (>90%)
Вы превращаетесь в «фирму-прокладку». Маржа крайне чувствительна к ценам субподрядчиков. Решение: часть критически важных работ выполнять собственными силами.

Б. Раздутая доля ФОТ и МиМ
Если доля зарплат и техники растёт, а выручка нет — эффективность падает. Люди «простаивают» или работы медленнее расценок. Решение: проверить нормы выработки.

В. Доля материалов выше рыночной
Либо скачок цен, либо проблемы с воровством, нецелевым использованием или браком. Решение: усилить контроль списания (М-29) и входной контроль качества.

3. Динамика структуры по месяцам
• Доля ФОТ стабильна, а Выручка падает: Постоянные затраты на персонал съедят подушку безопасности.
• Доля Субподряда растёт к концу проекта: Наняты «авральные» бригады дороже плана.`;

type ViewMode = 'absolute' | 'percent';

const fmtMln = (v: number): string => (v / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 });

// Порядок слоёв (снизу вверх)
const LAYER_ORDER = ['Материалы', 'Субподряд', 'ФОТ', 'Аренда', 'Накладные', 'Проектные'];

export const BdrCostStructureChart: FC<IProps> = ({ data, hoveredMonth, onChartReady }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('absolute');

  const costFact = data.kpis.costTotal;
  const costPlan = data.kpis.costPlanTotal;
  const delta = costFact - costPlan;
  const deltaPct = costPlan ? (delta / costPlan) * 100 : 0;
  const isOverspend = delta > 0;

  // Агрегируем план помесячно для маркеров
  const planByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of data.costStructure) {
      map.set(item.month, item.planTotal);
    }
    return map;
  }, [data.costStructure]);

  // Данные для 100% режима
  const percentData = useMemo((): ICostItem[] => {
    if (viewMode !== 'percent') return [];
    return data.costStructure.map((item) => ({
      ...item,
      value: item.monthTotal ? (item.value / item.monthTotal) * 100 : 0,
    }));
  }, [data.costStructure, viewMode]);

  const chartData = viewMode === 'absolute' ? data.costStructure : percentData;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: any = {
    data: chartData,
    xField: 'month',
    yField: 'value',
    colorField: 'category',
    stack: true,
    seriesField: 'category',
    isStack: true,
    // Фиксированный порядок слоёв
    scale: {
      color: {
        domain: LAYER_ORDER,
      },
    },
    axis: {
      x: {
        labelAutoRotate: true,
        labelAutoHide: true,
        title: null,
      },
      y: {
        title: viewMode === 'absolute' ? 'Сумма (млн руб.)' : 'Доля (%)',
        labelFormatter: viewMode === 'absolute'
          ? (v: number) => Math.round(v / 1_000_000).toLocaleString('ru-RU')
          : (v: number) => `${Math.round(v)}%`,
      },
    },
    tooltip: {
      title: (d: ICostItem) => d.month,
      items: [
        {
          field: 'value',
          name: (d: ICostItem) => d.category,
          valueFormatter: viewMode === 'absolute'
            ? (v: number) => `${fmtMln(v)} млн руб.`
            : (v: number) => `${v.toFixed(1)}%`,
        },
      ],
    },
    interaction: {
      tooltip: { shared: false },
    },
    annotations: [
      // Маркеры плана (step-line) — только для абсолютного режима
      ...(viewMode === 'absolute' ? Array.from(planByMonth.entries())
        .filter(([, v]) => v > 0)
        .map(([month, planVal]) => ({
          type: 'line' as const,
          xField: month,
          yField: planVal,
          style: { stroke: '#000', lineWidth: 2, lineDash: [0, 0] },
        })) : []),
      // Маркер синхронного hover
      ...(hoveredMonth ? [{
        type: 'lineX' as const,
        xField: hoveredMonth,
        style: { stroke: '#595959', lineDash: [2, 2], lineWidth: 1 },
      }] : []),
    ],
  };

  // Кастомный тултип через render
  config.tooltip = {
    shared: false,
    render: (_: unknown, { title: tooltipTitle, items }: { title: string; items: Array<{ name: string; value: number; color: string; record: ICostItem }> }) => {
      if (!items?.length) return '';
      const item = items[0];
      const rec = item.record || ({} as ICostItem);
      const monthPlan = rec.planTotal || 0;
      const monthFact = rec.monthTotal || 0;
      const monthDelta = monthFact - monthPlan;

      if (viewMode === 'percent') {
        return `<div style="padding:8px;font-size:13px;line-height:1.6">
          <div style="font-weight:600;margin-bottom:4px">${tooltipTitle}</div>
          <div><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color};margin-right:6px"></span>${item.name}: ${(rec.value || 0).toFixed(1)}%</div>
          <div style="color:#888;margin-top:4px">Факт: ${fmtMln(monthFact)} | План: ${fmtMln(monthPlan)} млн</div>
        </div>`;
      }

      const catVal = rec.value || 0;
      const pct = rec.percent || 0;
      return `<div style="padding:8px;font-size:13px;line-height:1.6">
        <div style="font-weight:600;margin-bottom:4px">${tooltipTitle}</div>
        <div><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color};margin-right:6px"></span>${item.name} — ${fmtMln(catVal)} млн руб.</div>
        <div>Доля: ${pct.toFixed(1)}%</div>
        <hr style="border:none;border-top:1px solid #eee;margin:4px 0"/>
        <div>Итого факт: ${fmtMln(monthFact)} млн руб.</div>
        <div>Итого план: ${fmtMln(monthPlan)} млн руб. | Δ: <span style="color:${monthDelta > 0 ? '#cf1322' : '#3f8600'}">${monthDelta > 0 ? '+' : ''}${fmtMln(monthDelta)}</span></div>
      </div>`;
    },
  };

  const title = (
    <span>
      Структура себестоимости{' '}
      <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{HELP_TEXT}</span>} overlayStyle={{ maxWidth: 480 }}>
        <InfoCircleOutlined className="bdr-bubble-help-icon" />
      </Tooltip>
    </span>
  );

  return (
    <div ref={chartRef}>
      <Card title={title} extra={<ShareChartButton chartRef={chartRef} title="Структура себестоимости" />} size="small" className="dashboard-chart-card">
        <Row gutter={16} style={{ marginBottom: 12 }}>
          <Col xs={8}>
            <Statistic
              title="Факт себестоимости"
              value={costFact / 1_000_000}
              precision={1}
              suffix="млн"
              valueStyle={{ fontSize: 16 }}
            />
          </Col>
          <Col xs={8}>
            <Statistic
              title="План себестоимости"
              value={costPlan / 1_000_000}
              precision={1}
              suffix="млн"
              valueStyle={{ fontSize: 16 }}
            />
          </Col>
          <Col xs={8}>
            <Statistic
              title="Отклонение (Δ)"
              value={Math.abs(delta) / 1_000_000}
              precision={1}
              suffix={`млн (${Math.abs(deltaPct).toFixed(1)}%)`}
              prefix={isOverspend ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              valueStyle={{ fontSize: 16, color: isOverspend ? '#cf1322' : '#3f8600' }}
            />
          </Col>
        </Row>
        <div style={{ marginBottom: 8, textAlign: 'right' }}>
          <Segmented
            size="small"
            value={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
            options={[
              { label: 'млн руб.', value: 'absolute' },
              { label: '100%', value: 'percent' },
            ]}
          />
        </div>
        <Column {...config} height={300} onReady={(chart: unknown) => { onChartReady?.(chart); }} />
      </Card>
    </div>
  );
};
