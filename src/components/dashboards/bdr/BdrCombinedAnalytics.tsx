import { type FC, useCallback, useRef, useState } from 'react';
import { Row, Col, Statistic, Card } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import type { IBdrDashboardData } from '../../../types/dashboard';
import { BdrScurveChart } from './BdrScurveChart';
import { BdrCostStructureChart } from './BdrCostStructureChart';

interface IProps {
  data: IBdrDashboardData;
}

const fmtMln = (v: number): string => (v / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 });

export const BdrCombinedAnalytics: FC<IProps> = ({ data }) => {
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scurveChartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const costChartRef = useRef<any>(null);

  const revenueFact = data.kpis.revenueFact;
  const costFact = data.kpis.costTotal;
  const grossProfit = revenueFact - costFact;
  const profitability = revenueFact ? (grossProfit / revenueFact) * 100 : 0;
  const isPositive = grossProfit >= 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleScurveReady = useCallback((chart: any) => {
    scurveChartRef.current = chart;
    chart.on('plot:pointermove', (evt: { data?: { data?: { x?: string; month?: string } } }) => {
      const month = evt?.data?.data?.x || evt?.data?.data?.month;
      if (month && costChartRef.current) {
        setHoveredMonth(month);
        try {
          costChartRef.current.emit('tooltip:show', {
            data: { data: { x: month } },
          });
        } catch { /* chart may not support */ }
      }
    });
    chart.on('plot:pointerleave', () => {
      setHoveredMonth(null);
      try {
        costChartRef.current?.emit('tooltip:hide');
      } catch { /* ignore */ }
    });
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCostReady = useCallback((chart: any) => {
    costChartRef.current = chart;
    chart.on('plot:pointermove', (evt: { data?: { data?: { x?: string; month?: string } } }) => {
      const month = evt?.data?.data?.x || evt?.data?.data?.month;
      if (month && scurveChartRef.current) {
        setHoveredMonth(month);
        try {
          scurveChartRef.current.emit('tooltip:show', {
            data: { data: { x: month } },
          });
        } catch { /* chart may not support */ }
      }
    });
    chart.on('plot:pointerleave', () => {
      setHoveredMonth(null);
      try {
        scurveChartRef.current?.emit('tooltip:hide');
      } catch { /* ignore */ }
    });
  }, []);

  return (
    <div>
      <Card size="small" className="dashboard-chart-card" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={8}>
            <Statistic
              title="Факт выполнения"
              value={revenueFact / 1_000_000}
              precision={1}
              suffix="млн"
              valueStyle={{ fontSize: 16 }}
            />
          </Col>
          <Col xs={8}>
            <Statistic
              title="Валовая прибыль"
              value={Math.abs(grossProfit) / 1_000_000}
              precision={1}
              suffix="млн"
              prefix={isPositive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              valueStyle={{ fontSize: 16, color: isPositive ? '#3f8600' : '#cf1322' }}
            />
          </Col>
          <Col xs={8}>
            <Statistic
              title="Рентабельность"
              value={Math.abs(profitability)}
              precision={1}
              suffix="%"
              prefix={isPositive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              valueStyle={{ fontSize: 16, color: isPositive ? '#3f8600' : '#cf1322' }}
            />
          </Col>
        </Row>
        <div style={{ marginTop: 4, fontSize: 11, color: '#8c8c8c' }}>
          Нарастающим итогом: Выручка {fmtMln(revenueFact)} − Себестоимость {fmtMln(costFact)} = Валовая прибыль {fmtMln(grossProfit)} млн
        </div>
      </Card>

      <BdrScurveChart
        data={data}
        hoveredMonth={hoveredMonth}
        onChartReady={handleScurveReady}
        showCostLine
      />
      <BdrCostStructureChart
        data={data}
        hoveredMonth={hoveredMonth}
        onChartReady={handleCostReady}
      />
    </div>
  );
};
