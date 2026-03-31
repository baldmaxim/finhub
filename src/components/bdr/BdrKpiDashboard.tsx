import type { FC } from 'react';
import { Row, Col, Card, Tooltip } from 'antd';
import {
  DashboardOutlined,
  PercentageOutlined,
  FundOutlined,
  TeamOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import type { BdrTableRow } from '../../types/bdr';

interface IProps {
  rows: BdrTableRow[];
}

interface IKpiItem {
  title: string;
  value: string;
  tooltip: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const getRowValue = (rows: BdrTableRow[], code: string, field: string): number => {
  const row = rows.find((r) => r.rowCode === code);
  return (row?.[field] as number) || 0;
};

const fmtPct = (v: number): string => v ? `${v.toFixed(1)}%` : '0%';
const fmtMln = (v: number): string => {
  if (!v) return '0';
  return (v / 1_000_000).toLocaleString('ru-RU', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + ' млн';
};

export const BdrKpiDashboard: FC<IProps> = ({ rows }) => {
  // Берём факт за последний месяц с данными для % показателей
  const getLastFactPercent = (code: string): number => {
    const row = rows.find((r) => r.rowCode === code);
    if (!row) return 0;
    for (let m = 12; m >= 1; m--) {
      const v = (row[`fact_month_${m}`] as number) || 0;
      if (v) return v;
    }
    return 0;
  };

  const readiness = getLastFactPercent('readiness_percent');
  const nzpToRevenue = getLastFactPercent('nzp_to_revenue');
  const grossMargin = getLastFactPercent('gross_margin');
  const netProfitMargin = getLastFactPercent('net_profit_margin');
  const laborCostRatio = getLastFactPercent('labor_cost_ratio');

  const revenueFact = getRowValue(rows, 'revenue', 'fact_total');
  const costFact = getRowValue(rows, 'cost_total', 'fact_total');
  const netProfitFact = getRowValue(rows, 'net_profit', 'fact_total');

  const kpis: IKpiItem[] = [
    {
      title: 'Процент готовности',
      value: fmtPct(readiness),
      tooltip: `Σ КС-2 с начала строительства / Контрактная стоимость. Выручка факт: ${fmtMln(revenueFact)}`,
      icon: <DashboardOutlined />,
      color: '#1677ff',
      bgColor: '#f0f5ff',
    },
    {
      title: 'НЗП / Выручка',
      value: fmtPct(nzpToRevenue),
      tooltip: 'Отношение незавершённого производства к выручке. Высокий % = риск кассового разрыва',
      icon: <AuditOutlined />,
      color: nzpToRevenue > 15 ? '#fa8c16' : '#52c41a',
      bgColor: nzpToRevenue > 15 ? '#fff7e6' : '#f6ffed',
    },
    {
      title: 'Gross Margin',
      value: fmtPct(grossMargin),
      tooltip: `Маржинальная прибыль / Выручка. Себестоимость факт: ${fmtMln(costFact)}`,
      icon: <PercentageOutlined />,
      color: grossMargin >= 15 ? '#52c41a' : grossMargin >= 5 ? '#fa8c16' : '#ff4d4f',
      bgColor: grossMargin >= 15 ? '#f6ffed' : grossMargin >= 5 ? '#fff7e6' : '#fff1f0',
    },
    {
      title: 'Net Profit Margin',
      value: fmtPct(netProfitMargin),
      tooltip: `Чистая прибыль / Выручка. Чистая прибыль факт: ${fmtMln(netProfitFact)}`,
      icon: <FundOutlined />,
      color: netProfitMargin >= 5 ? '#52c41a' : netProfitMargin >= 0 ? '#fa8c16' : '#ff4d4f',
      bgColor: netProfitMargin >= 5 ? '#f6ffed' : netProfitMargin >= 0 ? '#fff7e6' : '#fff1f0',
    },
    {
      title: 'Labor Cost Ratio',
      value: fmtPct(laborCostRatio),
      tooltip: 'Доля ФОТ в себестоимости. Индикатор трудоёмкости проекта',
      icon: <TeamOutlined />,
      color: '#722ed1',
      bgColor: '#f9f0ff',
    },
  ];

  return (
    <Row gutter={[12, 12]} className="bdr-kpi-dashboard">
      {kpis.map((kpi) => (
        <Col key={kpi.title} xs={12} sm={8} md={4} lg={4} xl={4}>
          <Tooltip title={kpi.tooltip} placement="bottom">
            <Card
              size="small"
              className="bdr-kpi-dash-card"
              style={{ borderLeft: `3px solid ${kpi.color}`, background: kpi.bgColor }}
            >
              <div className="bdr-kpi-dash-icon" style={{ color: kpi.color }}>
                {kpi.icon}
              </div>
              <div className="bdr-kpi-dash-value" style={{ color: kpi.color }}>
                {kpi.value}
              </div>
              <div className="bdr-kpi-dash-title">{kpi.title}</div>
            </Card>
          </Tooltip>
        </Col>
      ))}
    </Row>
  );
};
