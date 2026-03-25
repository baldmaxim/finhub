import { type FC, useRef } from 'react';
import { Card, Tooltip, Progress } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import type { IBdrDashboardData } from '../../../types/dashboard';
import { ShareChartButton } from '../../common/ShareChartButton';

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

function getColor(percent: number): string {
  if (percent < 5) return '#cf1322';
  if (percent < 15) return '#faad14';
  return '#3f8600';
}

export const BdrMarginGauge: FC<IProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const pct = data.marginPercent;
  const clampedPct = Math.max(0, Math.min(pct, 100));
  const color = getColor(pct);

  const title = (
    <span>
      Маржинальность{' '}
      <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{HELP_TEXT}</span>} overlayStyle={{ maxWidth: 480 }}>
        <InfoCircleOutlined className="bdr-bubble-help-icon" />
      </Tooltip>
    </span>
  );

  return (
    <div ref={chartRef}>
      <Card title={title} extra={<ShareChartButton chartRef={chartRef} title="Маржинальность" />} size="small" className="dashboard-chart-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <Progress
          type="dashboard"
          percent={clampedPct}
          strokeColor={color}
          size={220}
          format={() => (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 700, color }}>{pct.toFixed(1)}%</div>
              <div style={{ fontSize: 14, color: '#999' }}>Маржинальность</div>
            </div>
          )}
        />
        </div>
      </Card>
    </div>
  );
};
