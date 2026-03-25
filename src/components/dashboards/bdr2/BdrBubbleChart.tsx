import { type FC, useRef } from 'react';
import { Card, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Scatter } from '@ant-design/charts';
import type { IBubbleDataPoint } from '../../../types/dashboard';
import { ShareChartButton } from '../../common/ShareChartButton';

interface IProps {
  data: IBubbleDataPoint[];
}

const HELP_TEXT = `Как читать этот график для принятия решений:

Положение по горизонтали (Ось X): Показывает масштаб проекта (Выручка). Чем правее объект, тем больше он влияет на общий оборот компании.

Положение по вертикали (Ось Y): Эффективность (Рентабельность в %).
• Верхние квадранты: Зона успеха. Проекты приносят хорошую маржу.
• Нижние квадранты: Зона риска. Здесь находятся объекты, которые работают на грани окупаемости.

Размер пузырька (Объём НЗП): Это ваши «замороженные» деньги. Чем больше круг, тем больше работ выполнено, но не принято заказчиком (не подписаны КС-2).`;

export const BdrBubbleChart: FC<IProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const config = {
    data,
    xField: 'revenue',
    yField: 'profitability',
    sizeField: 'nzp',
    colorField: 'project',
    size: { range: [8, 60] },
    shapeField: 'point',
    axis: {
      x: {
        title: 'Выручка (₽)',
        labelFormatter: (v: number) => {
          if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'М';
          if (v >= 1_000) return (v / 1_000).toFixed(0) + 'К';
          return String(v);
        },
      },
      y: {
        title: 'Рентабельность (%)',
        labelFormatter: (v: number) => v + '%',
      },
    },
    tooltip: {
      title: (d: IBubbleDataPoint) => d.project,
      items: [
        {
          field: 'revenue',
          name: 'Выручка',
          valueFormatter: (v: number) => v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽',
        },
        {
          field: 'profitability',
          name: 'Рентабельность',
          valueFormatter: (v: number) => v + '%',
        },
        {
          field: 'nzp',
          name: 'НЗП',
          valueFormatter: (v: number) => v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽',
        },
      ],
    },
    legend: { position: 'bottom' as const },
    label: {
      text: 'project',
      position: 'top' as const,
      style: { fontSize: 10 },
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
