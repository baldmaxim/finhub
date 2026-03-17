import type { FC } from 'react';
import { Card, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Line } from '@ant-design/charts';
import type { IBdrDashboardData } from '../../../types/dashboard';

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
  const config = {
    data: data.scurve,
    xField: 'month',
    yField: 'value',
    colorField: 'type',
    scale: {
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
      lineWidth: 2,
    },
  };

  const title = (
    <span>
      S-кривая: план vs факт (кумулятивная выручка){' '}
      <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{HELP_TEXT}</span>} overlayStyle={{ maxWidth: 480 }}>
        <InfoCircleOutlined className="bdr-bubble-help-icon" />
      </Tooltip>
    </span>
  );

  return (
    <Card title={title} size="small" className="dashboard-chart-card">
      <Line {...config} height={300} />
    </Card>
  );
};
