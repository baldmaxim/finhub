import type { FC } from 'react';
import { Row, Col, Card, Tooltip } from 'antd';
import {
  DollarOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import type { IBblHealthMetrics } from '../../types/bbl';

interface IProps {
  metrics: IBblHealthMetrics;
}

interface IKpiItem {
  title: string;
  value: string;
  tooltip: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const fmtMln = (v: number): string => {
  if (!v) return '0';
  return (v / 1_000_000).toLocaleString('ru-RU', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + ' млн';
};

const fmtRatio = (v: number | null): string => {
  if (v === null) return 'N/A';
  return v.toFixed(2);
};

const fmtPct = (v: number): string => `${v.toFixed(1)}%`;

export const BblHealthCards: FC<IProps> = ({ metrics }) => {
  const { nwc, currentRatio, advanceCoverageRatio, wipShare } = metrics;

  // Current Ratio: норма для стройки 1.1-1.5
  const crColor = currentRatio === null
    ? '#8c8c8c'
    : currentRatio >= 1.1 && currentRatio <= 1.5
      ? '#52c41a'
      : currentRatio > 1.5
        ? '#1677ff'
        : '#ff4d4f';
  const crBg = currentRatio === null
    ? '#fafafa'
    : currentRatio >= 1.1 && currentRatio <= 1.5
      ? '#f6ffed'
      : currentRatio > 1.5
        ? '#f0f5ff'
        : '#fff1f0';

  // Advance Coverage Ratio: целевое > 1.0
  const acrColor = advanceCoverageRatio === null
    ? '#8c8c8c'
    : advanceCoverageRatio >= 1.0
      ? '#52c41a'
      : advanceCoverageRatio >= 0.7
        ? '#fa8c16'
        : '#ff4d4f';
  const acrBg = advanceCoverageRatio === null
    ? '#fafafa'
    : advanceCoverageRatio >= 1.0
      ? '#f6ffed'
      : advanceCoverageRatio >= 0.7
        ? '#fff7e6'
        : '#fff1f0';

  const kpis: IKpiItem[] = [
    {
      title: 'NWC (Чистый оборотный капитал)',
      value: fmtMln(nwc),
      tooltip: `Оборотные активы − Краткосрочные обязательства. ${nwc > 0 ? 'Положительный — компания покрывает краткосрочные долги' : 'Отрицательный — риск неплатёжеспособности'}`,
      icon: <DollarOutlined />,
      color: nwc >= 0 ? '#52c41a' : '#ff4d4f',
      bgColor: nwc >= 0 ? '#f6ffed' : '#fff1f0',
    },
    {
      title: 'Current Ratio (Тек. ликвидность)',
      value: fmtRatio(currentRatio),
      tooltip: currentRatio === null
        ? 'Краткосрочные обязательства = 0, расчёт невозможен'
        : `Оборотные активы / Краткосрочные обязательства. Норма для стройки: 1.1–1.5. Текущее: ${fmtRatio(currentRatio)}`,
      icon: <SafetyCertificateOutlined />,
      color: crColor,
      bgColor: crBg,
    },
    {
      title: 'Покрытие авансов',
      value: fmtRatio(advanceCoverageRatio),
      tooltip: advanceCoverageRatio === null
        ? 'Авансы выданные = 0, расчёт невозможен'
        : `Авансы полученные / Авансы выданные. Целевое значение > 1.0. Текущее: ${fmtRatio(advanceCoverageRatio)}`,
      icon: <SwapOutlined />,
      color: acrColor,
      bgColor: acrBg,
    },
    {
      title: 'Доля НЗП в активах',
      value: fmtPct(wipShare),
      tooltip: `Запасы и НЗП / ИТОГО АКТИВЫ × 100%. ${wipShare > 30 ? 'Высокая доля — стройка морозит капитал' : 'Нормальный уровень'}`,
      icon: <ExperimentOutlined />,
      color: wipShare > 30 ? '#ff4d4f' : wipShare > 20 ? '#fa8c16' : '#52c41a',
      bgColor: wipShare > 30 ? '#fff1f0' : wipShare > 20 ? '#fff7e6' : '#f6ffed',
    },
  ];

  return (
    <Row gutter={[12, 12]} className="bbl-health-cards">
      {kpis.map((kpi) => (
        <Col key={kpi.title} xs={12} sm={12} md={6} lg={6} xl={6}>
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
