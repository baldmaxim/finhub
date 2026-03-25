import { type FC, useRef } from 'react';
import { Card, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Column } from '@ant-design/charts';
import type { IBdrDashboardData } from '../../../types/dashboard';
import { ShareChartButton } from '../../common/ShareChartButton';

interface IProps {
  data: IBdrDashboardData;
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

export const BdrCostStructureChart: FC<IProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const config = {
    data: data.costStructure,
    xField: 'month',
    yField: 'value',
    colorField: 'category',
    stack: true,
    axis: {
      y: {
        labelFormatter: (v: number) => (v / 1000000).toFixed(1) + 'М',
      },
    },
    tooltip: {
      items: [
        {
          field: 'value',
          valueFormatter: (v: number) => v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽',
        },
      ],
    },
    interaction: {
      tooltip: { shared: true },
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
        <Column {...config} height={300} />
      </Card>
    </div>
  );
};
