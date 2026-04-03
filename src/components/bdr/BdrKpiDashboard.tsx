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
  yearRows: Map<number, BdrTableRow[]>;
  onNzpClick?: () => void;
}

interface IKpiItem {
  title: string;
  value: string;
  tooltip: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  onClick?: () => void;
}

const fmtPct = (v: number): string => v ? `${v.toFixed(1)}%` : '0%';
const fmtMln = (v: number): string => {
  if (!v) return '0';
  return (v / 1_000_000).toLocaleString('ru-RU', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + ' млн';
};

/** Последний ненулевой факт-% по коду строки среди ВСЕХ годов */
const getLastFactPercent = (yearRows: Map<number, BdrTableRow[]>, code: string): number => {
  const years = [...yearRows.keys()].sort((a, b) => b - a);
  for (const yr of years) {
    const rows = yearRows.get(yr);
    const row = rows?.find((r) => r.rowCode === code);
    if (!row) continue;
    for (let m = 12; m >= 1; m--) {
      const v = (row[`fact_month_${m}`] as number) || 0;
      if (v) return v;
    }
  }
  return 0;
};

/** Суммирует fact_total по коду строки за все годы */
const getTotalFact = (yearRows: Map<number, BdrTableRow[]>, code: string): number => {
  let total = 0;
  for (const rows of yearRows.values()) {
    const row = rows.find((r) => r.rowCode === code);
    total += (row?.fact_total as number) || 0;
  }
  return total;
};

export const BdrKpiDashboard: FC<IProps> = ({ yearRows, onNzpClick }) => {
  // % готовности и НЗП — кумулятивные, берём последний ненулевой месяц
  const readiness = getLastFactPercent(yearRows, 'readiness_percent');
  const nzpToRevenue = getLastFactPercent(yearRows, 'nzp_to_revenue');

  // Абсолютные значения из ИТОГО ФАКТ (Project to Date)
  const revenueFact = getTotalFact(yearRows, 'revenue');
  const directCostFact = getTotalFact(yearRows, 'direct_cost_total');
  const overheadFact = getTotalFact(yearRows, 'cost_overhead');
  const costFact = directCostFact + overheadFact;
  const netProfitFact = getTotalFact(yearRows, 'net_profit');
  const laborFact = getTotalFact(yearRows, 'cost_labor');

  // Расчёт KPI из кумулятивных ИТОГО (не из последнего месяца)
  const grossMargin = revenueFact ? ((revenueFact - costFact) / revenueFact) * 100 : 0;
  const netProfitMargin = revenueFact ? (netProfitFact / revenueFact) * 100 : 0;
  const laborCostRatio = costFact ? (laborFact / costFact) * 100 : 0;

  // НЗП: отрицательное = Перевыполнение (Overbilling)
  const isOverbilling = nzpToRevenue < 0;
  const nzpDisplay = isOverbilling ? Math.abs(nzpToRevenue) : nzpToRevenue;
  const nzpLabel = isOverbilling ? 'Перевыполнение (Overbilling)' : 'НЗП / Выручка';

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
      title: nzpLabel,
      value: fmtPct(nzpDisplay),
      tooltip: isOverbilling
        ? 'КС-2 принято больше, чем выполнено — позитивный кэш-флоу для компании'
        : nzpToRevenue > 10
          ? 'Клик: показать статьи с разрывом КС-2. Высокий % = риск кассового разрыва'
          : 'Отношение незавершённого производства к выручке',
      icon: <AuditOutlined />,
      color: isOverbilling ? '#52c41a' : (nzpToRevenue > 15 ? '#fa8c16' : '#52c41a'),
      bgColor: isOverbilling ? '#f6ffed' : (nzpToRevenue > 15 ? '#fff7e6' : '#f6ffed'),
      onClick: !isOverbilling && nzpToRevenue > 10 ? onNzpClick : undefined,
    },
    {
      title: 'Валовая рентабельность (Gross Margin)',
      value: fmtPct(grossMargin),
      tooltip: `(Выручка − Себестоимость) / Выручка. Итого факт: выручка ${fmtMln(revenueFact)}, себестоимость ${fmtMln(costFact)}`,
      icon: <PercentageOutlined />,
      color: grossMargin >= 15 ? '#52c41a' : grossMargin >= 5 ? '#fa8c16' : '#ff4d4f',
      bgColor: grossMargin >= 15 ? '#f6ffed' : grossMargin >= 5 ? '#fff7e6' : '#fff1f0',
    },
    {
      title: 'Рентабельность по чистой прибыли (Net Profit Margin)',
      value: fmtPct(netProfitMargin),
      tooltip: `Чистая прибыль / Выручка. Итого факт: ${fmtMln(netProfitFact)}`,
      icon: <FundOutlined />,
      color: netProfitMargin >= 5 ? '#52c41a' : netProfitMargin >= 0 ? '#fa8c16' : '#ff4d4f',
      bgColor: netProfitMargin >= 5 ? '#f6ffed' : netProfitMargin >= 0 ? '#fff7e6' : '#fff1f0',
    },
    {
      title: 'Доля ФОТ в себестоимости (Labor Cost Ratio)',
      value: fmtPct(laborCostRatio),
      tooltip: `Доля ФОТ в полной себестоимости. Итого факт: ФОТ ${fmtMln(laborFact)}, себестоимость ${fmtMln(costFact)}`,
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
              className={`bdr-kpi-dash-card${kpi.onClick ? ' bdr-kpi-clickable' : ''}`}
              style={{ borderLeft: `3px solid ${kpi.color}`, background: kpi.bgColor }}
              onClick={kpi.onClick}
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
