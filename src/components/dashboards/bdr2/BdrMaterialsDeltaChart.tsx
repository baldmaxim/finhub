import { type FC, useRef } from 'react';
import { Card, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { DualAxes } from '@ant-design/charts';
import type { IMaterialsDeltaData } from '../../../types/dashboard';
import { ShareChartButton } from '../../common/ShareChartButton';

interface IProps {
  data: IMaterialsDeltaData;
}

const HELP_TEXT = `Сравнение оплаченных и списанных материалов:

• Столбец «БДДС Оплата» — сумма, выплаченная поставщикам (факт из БДДС).
• Столбец «БДР Списание» — материалы, списанные в производство (факт из БДР).
• Линия «Дельта» — накопленная разница (оплачено минус списано).

Положительная дельта = замороженные деньги в материалах на складе.
Отрицательная дельта = списание идёт быстрее оплат (кредиторская задолженность).`;

export const BdrMaterialsDeltaChart: FC<IProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const valueFormatter = (v: number) =>
    v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';

  const lineData = data.line;

  const config = {
    xField: 'month',
    children: [
      {
        data: data.columns,
        type: 'interval' as const,
        yField: 'value',
        colorField: 'type',
        group: true,
        scale: {
          color: {
            domain: ['БДДС Оплата', 'БДР Списание'],
            range: ['#5B8FF9', '#5AD8A6'],
          },
        },
        style: {
          maxWidth: 32,
        },
        axis: {
          y: {
            labelFormatter: (v: number) => (v / 1000000).toFixed(1) + 'М',
          },
        },
        tooltip: {
          items: [{ channel: 'y', valueFormatter }],
        },
        interaction: {
          tooltip: { shared: true },
        },
      },
      {
        data: lineData,
        type: 'line' as const,
        yField: 'value',
        style: {
          lineWidth: 2.5,
          stroke: '#ff4d4f',
        },
        axis: {
          y: {
            position: 'right' as const,
            labelFormatter: (v: number) => (v / 1000000).toFixed(1) + 'М',
          },
        },
        tooltip: {
          items: [
            (d: Record<string, number>) => ({
              name: 'Дельта',
              value: valueFormatter(d.value),
              color: '#ff4d4f',
            }),
          ],
        },
      },
      {
        type: 'lineY' as const,
        data: [0],
        style: {
          stroke: '#ff4d4f',
          strokeOpacity: 0.45,
          lineDash: [4, 4],
          lineWidth: 1,
        },
      },
    ],
  };

  const title = (
    <span>
      Материалы: оплата vs списание{' '}
      <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{HELP_TEXT}</span>} overlayStyle={{ maxWidth: 480 }}>
        <InfoCircleOutlined className="bdr-bubble-help-icon" />
      </Tooltip>
    </span>
  );

  return (
    <div ref={chartRef}>
      <Card title={title} extra={<ShareChartButton chartRef={chartRef} title="Материалы оплата vs списание" />} size="small" className="dashboard-chart-card">
        <DualAxes {...config} height={350} />
      </Card>
    </div>
  );
};
