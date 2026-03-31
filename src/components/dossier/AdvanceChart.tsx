import { useMemo } from 'react';
import type { FC } from 'react';
import { Line } from '@ant-design/charts';

interface IProps {
  contractTotal: number;
  aOst: number;
  wRem: number;
  wFact: number;
  nonTargetDeduction: number;
}

const toB = (v: number) => +(v / 1_000_000_000).toFixed(2);

export const AdvanceChart: FC<IProps> = ({
  contractTotal,
  aOst,
  wRem,
  wFact,
  nonTargetDeduction,
}) => {
  const data = useMemo(() => {
    const months = 33;
    const result: { month: string; value: number; series: string }[] = [];
    let advanceBalance = aOst;
    let backlog = wRem;

    for (let i = 0; i <= months; i++) {
      const label = `М${i}`;

      result.push({ month: label, value: toB(advanceBalance), series: 'Остаток авансов' });
      result.push({ month: label, value: toB(backlog), series: 'Бэклог (невыполн. работы)' });
      result.push({
        month: label,
        value: toB(contractTotal - backlog),
        series: 'Выполнено нарастающим',
      });

      if (i < months) {
        const monthlyWork = wFact * (0.7 + Math.random() * 0.6);
        const deduction = backlog > 0
          ? (advanceBalance / backlog) * monthlyWork
          : 0;
        advanceBalance = Math.max(0, advanceBalance - deduction);
        backlog = Math.max(0, backlog - monthlyWork);
      }
    }
    return result;
  }, [contractTotal, aOst, wRem, wFact, nonTargetDeduction]);

  const config = {
    data,
    xField: 'month',
    yField: 'value',
    colorField: 'series',
    smooth: true,
    height: 300,
    axis: {
      y: {
        title: 'млрд ₽',
        labelFormatter: (v: number) => `${v}`,
      },
    },
    tooltip: {
      channel: 'y',
      valueFormatter: (v: number) => `${v} млрд ₽`,
    },
    style: {
      lineWidth: 2,
    },
    legend: {
      position: 'top' as const,
    },
  };

  return <Line {...config} />;
};
