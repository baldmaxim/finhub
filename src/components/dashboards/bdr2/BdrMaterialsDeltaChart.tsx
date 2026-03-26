import { type FC, useMemo, useRef } from 'react';
import { Card, Tooltip, Statistic, Row, Col } from 'antd';
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
• Линия «Сальдо» — накопленная разница (оплачено минус списано).

Положительное сальдо = замороженные деньги на складе.
Отрицательное сальдо = кредиторская задолженность перед поставщиками.`;

const LEGEND_ITEMS = [
  { color: '#5B8FF9', label: 'БДДС Оплата', isRect: true },
  { color: '#5AD8A6', label: 'БДР Списание', isRect: true },
  { color: '#ff4d4f', label: 'Сальдо (Склад / Задолженность)', isLine: true },
];

const formatMln = (v: number): string =>
  (v / 1_000_000).toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const axisFormatter = (v: number): string => {
  const mln = v / 1_000_000;
  return mln % 1 === 0 ? mln.toFixed(0) : mln.toFixed(1);
};

export const BdrMaterialsDeltaChart: FC<IProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  // KPI — нарастающие итоги
  const kpi = useMemo(() => {
    let totalPaid = 0;
    let totalWritten = 0;
    for (const c of data.columns) {
      if (c.type === 'БДДС Оплата') totalPaid += c.value;
      else totalWritten += c.value;
    }
    const saldo = totalPaid - totalWritten;
    return { totalPaid, totalWritten, saldo };
  }, [data.columns]);

  // Tooltip map
  const tooltipMap = useMemo(() => {
    const map = new Map<string, { paid: number; written: number; saldo: number }>();
    const colMap = new Map<string, { paid: number; written: number }>();
    for (const c of data.columns) {
      if (!colMap.has(c.month)) colMap.set(c.month, { paid: 0, written: 0 });
      const entry = colMap.get(c.month)!;
      if (c.type === 'БДДС Оплата') entry.paid = c.value;
      else entry.written = c.value;
    }
    for (const l of data.line) {
      const col = colMap.get(l.month);
      map.set(l.month, {
        paid: col?.paid || 0,
        written: col?.written || 0,
        saldo: l.value,
      });
    }
    return map;
  }, [data]);

  // Синхронизация нуля: вычисляем общий домен для обеих осей
  const { leftDomain, rightDomain } = useMemo(() => {
    let leftMin = 0, leftMax = 0;
    let rightMin = 0, rightMax = 0;

    for (const c of data.columns) {
      if (c.value < leftMin) leftMin = c.value;
      if (c.value > leftMax) leftMax = c.value;
    }
    for (const l of data.line) {
      if (l.value < rightMin) rightMin = l.value;
      if (l.value > rightMax) rightMax = l.value;
    }

    // Добавляем padding
    const leftPad = (leftMax - leftMin) * 0.1 || 1;
    const rightPad = (rightMax - rightMin) * 0.1 || 1;
    leftMin -= leftPad;
    leftMax += leftPad;
    rightMin -= rightPad;
    rightMax += rightPad;

    // Синхронизация нуля: 0 должен быть на одной горизонтальной линии
    // ratio = позиция нуля в диапазоне [min, max] = -min / (max - min)
    const leftRatio = leftMax > leftMin ? -leftMin / (leftMax - leftMin) : 0.5;
    const rightRatio = rightMax > rightMin ? -rightMin / (rightMax - rightMin) : 0.5;
    const targetRatio = Math.max(leftRatio, rightRatio);

    // Подгоняем домены чтобы нули совпали
    if (targetRatio > leftRatio) {
      leftMin = -targetRatio * (leftMax - leftMin) / (1 - targetRatio + leftRatio) + leftMin * leftRatio / (1 - targetRatio + leftRatio);
      leftMin = -(targetRatio / (1 - targetRatio)) * leftMax;
    } else if (targetRatio > rightRatio) {
      rightMin = -(targetRatio / (1 - targetRatio)) * rightMax;
    }

    return {
      leftDomain: [leftMin, leftMax] as [number, number],
      rightDomain: [rightMin, rightMax] as [number, number],
    };
  }, [data]);

  const config = {
    xField: 'month',
    interaction: {
      tooltip: {
        render: (_: unknown, { items }: { items: Array<{ value: unknown }> }) => {
          const firstItem = items[0] as { data?: Record<string, unknown> };
          const monthKey = (firstItem?.data?.month as string) || '';
          const info = tooltipMap.get(monthKey);
          if (!info) return '';
          return `<div style="padding:4px 0;font-size:13px;line-height:1.6">
            <div style="font-weight:600;margin-bottom:4px">${monthKey}</div>
            <div>Оплата: <b>${formatMln(info.paid)} млн руб.</b></div>
            <div>Списание: <b>${formatMln(info.written)} млн руб.</b></div>
            <div>Сальдо: <b style="color:${info.saldo >= 0 ? '#faad14' : '#ff4d4f'}">${info.saldo >= 0 ? '+' : ''}${formatMln(info.saldo)} млн руб.</b></div>
          </div>`;
        },
      },
    },
    children: [
      // Сгруппированные столбцы
      {
        data: data.columns,
        type: 'interval' as const,
        yField: 'value',
        colorField: 'type',
        group: true,
        scale: {
          y: {
            key: 'left',
            domainMin: leftDomain[0],
            domainMax: leftDomain[1],
          },
          color: {
            domain: ['БДДС Оплата', 'БДР Списание'],
            range: ['#5B8FF9', '#5AD8A6'],
          },
        },
        style: {
          maxWidth: 28,
        },
        axis: {
          x: {
            title: false,
            labelAutoRotate: false,
          },
          y: {
            title: 'Движение за месяц (млн)',
            titleFontSize: 11,
            labelFormatter: axisFormatter,
          },
        },
        legend: false,
        tooltip: {
          items: [
            {
              channel: 'y',
              valueFormatter: (v: number) => formatMln(v) + ' млн руб.',
            },
          ],
        },
      },
      // Линия сальдо
      {
        data: data.line,
        type: 'line' as const,
        yField: 'value',
        colorField: 'type',
        scale: {
          y: {
            key: 'right',
            domainMin: rightDomain[0],
            domainMax: rightDomain[1],
          },
          color: {
            domain: ['Сальдо (Склад / Задолженность)'],
            range: ['#ff4d4f'],
          },
        },
        style: {
          lineWidth: 2.5,
        },
        axis: {
          y: {
            position: 'right' as const,
            title: 'Накопленное сальдо (млн)',
            titleFontSize: 11,
            labelFormatter: axisFormatter,
          },
        },
        legend: false,
        tooltip: {
          items: [
            (d: Record<string, number>) => ({
              name: 'Сальдо',
              value: formatMln(d.value) + ' млн руб.',
              color: '#ff4d4f',
            }),
          ],
        },
      },
      // Нулевая линия
      {
        type: 'lineY' as const,
        data: [0],
        scale: { y: { key: 'left' } },
        style: {
          stroke: '#8c8c8c',
          strokeOpacity: 0.4,
          lineDash: [4, 4],
          lineWidth: 1,
        },
      },
    ],
  };

  // Цвет сальдо в KPI
  const saldoColor = kpi.saldo > 0
    ? (kpi.saldo / kpi.totalPaid > 0.3 ? '#fa8c16' : '#faad14')
    : (kpi.saldo / kpi.totalPaid < -0.3 ? '#ff4d4f' : '#fa541c');

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
        {/* KPI блок */}
        <Row gutter={16} style={{ marginBottom: 12 }}>
          <Col xs={8}>
            <Statistic
              title="Оплачено (БДДС)"
              value={formatMln(kpi.totalPaid)}
              suffix="млн руб."
              valueStyle={{ fontSize: 16, fontWeight: 600, color: '#5B8FF9' }}
            />
          </Col>
          <Col xs={8}>
            <Statistic
              title="Списано (БДР)"
              value={formatMln(kpi.totalWritten)}
              suffix="млн руб."
              valueStyle={{ fontSize: 16, fontWeight: 600, color: '#5AD8A6' }}
            />
          </Col>
          <Col xs={8}>
            <Statistic
              title="Сальдо (Склад)"
              value={(kpi.saldo >= 0 ? '+' : '') + formatMln(kpi.saldo)}
              suffix="млн руб."
              valueStyle={{ fontSize: 16, fontWeight: 600, color: saldoColor }}
            />
          </Col>
        </Row>
        {/* Легенда */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
          {LEGEND_ITEMS.map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              {item.isLine ? (
                <span style={{ width: 16, height: 3, background: item.color, display: 'inline-block', borderRadius: 1 }} />
              ) : (
                <span style={{ width: 12, height: 10, background: item.color, opacity: 0.8, display: 'inline-block', borderRadius: 2 }} />
              )}
              <span style={{ color: '#595959' }}>{item.label}</span>
            </div>
          ))}
        </div>
        <DualAxes {...config} height={320} />
      </Card>
    </div>
  );
};
