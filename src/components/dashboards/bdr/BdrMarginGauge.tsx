import type { FC } from 'react';
import { Card, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Gauge } from '@ant-design/charts';
import type { IBdrDashboardData } from '../../../types/dashboard';

interface IProps {
  data: IBdrDashboardData;
}

const HELP_TEXT = `1. Тренды: куда идёт линия?
• Восходящий тренд: Вы повышаете цены или оптимизируете себестоимость (дешевле поставщики, новая технология).
• Нисходящий тренд: Себестоимость растёт быстрее, чем перекладывается на заказчика. В стройке — подорожание арматуры, бетона или ошибки в сметах.
• «Пила» (резкие скачки): Плохое планирование или специфика учёта — расходы в одном месяце, доходы в другом.

2. Сравнение с «Бенчмарком» (Эталоном)
Целевой показатель (например, 15%):
• Выше линии: Объект/месяц эффективен.
• Ниже линии: Работа «ради работы» — ресурсы тратятся, но почти ничего не зарабатывается.

3. Разрыв между Валовой и Чистой маржой
• Валовая маржа: (Выручка − Себестоимость). Эффективность на стройплощадке.
• Чистая маржа: (Чистая прибыль / Выручка). Эффективность всей компании.
Если валовая высокая (25%), а чистая низкая (2%) — «бэк-офис» (управленцы, аренда, юристы) слишком раздут.

4. Анализ «Маржа vs Объём»
При росте объёма выручки маржинальность часто падает — для крупных объектов приходится демпинговать. На графике это «ножницы»: работы много, а денег на развитие нет.`;

export const BdrMarginGauge: FC<IProps> = ({ data }) => {
  const percent = Math.max(0, Math.min(data.marginPercent / 100, 1));

  const config = {
    percent,
    range: {
      color: ['#cf1322', '#faad14', '#3f8600'],
      width: 12,
    },
    indicator: {
      pointer: { style: { stroke: '#D0D0D0' } },
      pin: { style: { stroke: '#D0D0D0' } },
    },
    statistic: {
      content: {
        formatter: () => data.marginPercent.toFixed(1) + '%',
        style: { fontSize: '24px', color: '#333' },
      },
      title: {
        formatter: () => 'Маржинальность',
        style: { fontSize: '14px', color: '#999' },
      },
    },
  };

  const title = (
    <span>
      Маржинальность{' '}
      <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{HELP_TEXT}</span>} overlayStyle={{ maxWidth: 480 }}>
        <InfoCircleOutlined className="bdr-bubble-help-icon" />
      </Tooltip>
    </span>
  );

  return (
    <Card title={title} size="small" className="dashboard-chart-card">
      <Gauge {...config} height={300} />
    </Card>
  );
};
