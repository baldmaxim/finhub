import type { FC } from 'react';
import { Card, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { DualAxes } from '@ant-design/charts';
import type { IMaterialsDeltaData } from '../../../types/dashboard';

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
  const valueFormatter = (v: number) =>
    v.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';

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
        data: data.line,
        type: 'line' as const,
        yField: 'value',
        colorField: 'type',
        scale: {
          color: {
            domain: ['Дельта (накопл.)'],
            range: ['#ff4d4f'],
          },
        },
        style: {
          lineWidth: 2.5,
        },
        axis: {
          y: {
            position: 'right' as const,
            labelFormatter: (v: number) => (v / 1000000).toFixed(1) + 'М',
          },
        },
        tooltip: {
          items: [{ channel: 'y', valueFormatter }],
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
    <Card title={title} size="small" className="dashboard-chart-card">
      <DualAxes {...config} height={350} />
    </Card>
  );
};
