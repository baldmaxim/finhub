import type { FC } from 'react';
import { Card, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Area } from '@ant-design/charts';
import type { IExecutionVsKsPoint } from '../../../types/dashboard';

interface IProps {
  data: IExecutionVsKsPoint[];
}

const HELP_TEXT = `Как читать этот график:

1. Анализ «Разрыва» (Зона НЗП)
Расстояние между линией Выполнения (то, что сделал прораб) и линией Актирования (то, что принял заказчик) — это ваше Незавершённое производство (НЗП).

• Линия Выполнения выше Актирования: Копятся «замороженные» деньги. Вы платите рабочим, закупаете материалы, но юридически выручки ещё нет. Если разрыв растёт — ждите кассового разрыва.

• Линия Актирования догоняет или выше Выполнения: «Закрытие хвостов». Подписываются акты за прошлые периоды — отличный момент для притока наличности.

2. Оценка Ритмичности
• Параллельные линии: Идеальная ситуация. Сдача работ идёт синхронно со строительством, документооборот налажен.

• Пересекающиеся линии («Ножницы»): Сигнал нестабильности. Проблемы с ПТО (не успевает готовить исполнительную документацию) или заказчик затягивает приёмку.`;

export const BdrExecutionVsKsChart: FC<IProps> = ({ data }) => {
  const config = {
    data,
    xField: 'month',
    yField: 'value',
    colorField: 'type',
    scale: {
      color: {
        domain: ['Выполнение', 'Актирование (КС-2)'],
        range: ['#ff7a45', '#1890ff'],
      },
    },
    axis: {
      y: {
        title: 'Сумма (₽), кумулятивно',
        labelFormatter: (v: number) => {
          if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'М';
          if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(0) + 'К';
          return String(v);
        },
      },
    },
    tooltip: {
      items: [
        {
          channel: 'y',
          valueFormatter: (v: number) => v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽',
        },
      ],
    },
    interaction: {
      tooltip: { shared: true },
    },
    style: {
      fillOpacity: 0.15,
      lineWidth: 2,
      connect: true,
      connectLineDash: [4, 4],
      connectStroke: '#ccc',
    },
    legend: { position: 'bottom' as const },
  };

  const title = (
    <span>
      Выполнение vs Актирование (КС-2){' '}
      <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{HELP_TEXT}</span>} overlayStyle={{ maxWidth: 520 }}>
        <InfoCircleOutlined className="bdr-bubble-help-icon" />
      </Tooltip>
    </span>
  );

  return (
    <Card title={title} size="small" className="dashboard-chart-card">
      <Area {...config} height={380} />
    </Card>
  );
};
