import type { FC } from 'react';
import { Row, Col, Card } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import type { IBdrDashboardData } from '../../../types/dashboard';

const fmtMln = (v: number) => (v / 1_000_000).toLocaleString('ru-RU', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const fmtDeltaPct = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(1) + '%';

interface IKpiCard {
  title: string;
  fact: number;
  plan: number;
  /** true = рост факта — плохо (себестоимость) */
  inverted?: boolean;
  /** рентабельность % рядом с суммой */
  profitPct?: number;
}

const KpiCard: FC<IKpiCard> = ({ title, fact, plan, inverted, profitPct }) => {
  const delta = fact - plan;
  const deltaPct = plan ? (delta / plan) * 100 : 0;
  const isPositive = inverted ? delta <= 0 : delta >= 0;
  const color = isPositive ? '#52c41a' : '#ff4d4f';
  const Icon = delta >= 0 ? ArrowUpOutlined : ArrowDownOutlined;

  const deltaLabel = inverted
    ? (delta > 0 ? 'Перерасход' : 'Экономия')
    : 'Отклонение';

  return (
    <Card size="small" className="bdr-kpi-card">
      <div className="bdr-kpi-title">{title}</div>
      <div className="bdr-kpi-fact">
        {fmtMln(fact)} млн
        {profitPct !== undefined && (
          <span className="bdr-kpi-pct" style={{ color: profitPct >= 0 ? '#52c41a' : '#ff4d4f' }}>
            {' '}({profitPct.toFixed(1)}%)
          </span>
        )}
      </div>
      <div className="bdr-kpi-plan">Бюджет: {fmtMln(plan)} млн</div>
      <div className="bdr-kpi-delta" style={{ color }}>
        <Icon /> {deltaLabel}: {delta >= 0 ? '+' : ''}{fmtMln(delta)} млн ({fmtDeltaPct(deltaPct)})
      </div>
    </Card>
  );
};

interface IProps {
  data: IBdrDashboardData;
}

export const BdrKpiCards: FC<IProps> = ({ data }) => {
  const { kpis } = data;

  const grossFact = kpis.revenueFact - kpis.costTotal;
  const grossPlan = kpis.revenuePlan - kpis.costPlanTotal;
  const grossPct = kpis.revenueFact ? (grossFact / kpis.revenueFact) * 100 : 0;

  return (
    <Row gutter={[16, 16]} className="dashboard-kpi-row">
      <Col xs={12} md={6}>
        <KpiCard
          title="Выручка"
          fact={kpis.revenueFact}
          plan={kpis.revenuePlan}
        />
      </Col>
      <Col xs={12} md={6}>
        <KpiCard
          title="Себестоимость"
          fact={kpis.costTotal}
          plan={kpis.costPlanTotal}
          inverted
        />
      </Col>
      <Col xs={12} md={6}>
        <KpiCard
          title="Валовая прибыль"
          fact={grossFact}
          plan={grossPlan}
          profitPct={grossPct}
        />
      </Col>
      <Col xs={12} md={6}>
        <KpiCard
          title="Операционная прибыль"
          fact={kpis.operatingProfit}
          plan={kpis.operatingProfitPlan}
          profitPct={kpis.operatingProfitPct}
        />
      </Col>
    </Row>
  );
};
