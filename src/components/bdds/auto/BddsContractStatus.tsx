import { FC } from 'react';
import { Row, Col, Card, Statistic, Spin, Typography, Progress } from 'antd';
import {
  BankOutlined,
  ArrowDownOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { IBddsContractStatus } from '../../../types/bddsAuto';

interface IProps {
  status: IBddsContractStatus | null;
  loading: boolean;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n);
}

const STAT_ITEMS = [
  {
    key: 'contract_amount' as keyof IBddsContractStatus,
    label: 'Сумма договора',
    icon: <BankOutlined style={{ fontSize: 20 }} />,
    colorClass: 'bdds-auto-stat--total',
  },
  {
    key: 'advances_received' as keyof IBddsContractStatus,
    label: 'Получено авансов',
    icon: <ArrowDownOutlined style={{ fontSize: 20 }} />,
    colorClass: 'bdds-auto-stat--advances',
  },
  {
    key: 'works_received' as keyof IBddsContractStatus,
    label: 'Сдано работ (КС)',
    icon: <CheckCircleOutlined style={{ fontSize: 20 }} />,
    colorClass: 'bdds-auto-stat--works',
  },
  {
    key: 'gu_returned' as keyof IBddsContractStatus,
    label: 'Возврат ГУ',
    icon: <SafetyCertificateOutlined style={{ fontSize: 20 }} />,
    colorClass: 'bdds-auto-stat--gu',
  },
  {
    key: 'remaining' as keyof IBddsContractStatus,
    label: 'Остаток к получению',
    icon: <ClockCircleOutlined style={{ fontSize: 20 }} />,
    colorClass: 'bdds-auto-stat--remaining',
  },
];

export const BddsContractStatus: FC<IProps> = ({ status, loading }) => {
  if (loading) {
    return (
      <Card className="bdds-auto-status-card">
        <Spin />
      </Card>
    );
  }

  if (!status) {
    return (
      <Card className="bdds-auto-status-card">
        <Typography.Text type="secondary">Выберите проект для отображения статуса</Typography.Text>
      </Card>
    );
  }

  const receivedPct = status.contract_amount > 0
    ? Math.min(100, Math.round((status.total_received / status.contract_amount) * 100))
    : 0;

  return (
    <Card
      title="Статус договора"
      className="bdds-auto-status-card"
      extra={
        <Progress
          percent={receivedPct}
          size="small"
          status={receivedPct >= 100 ? 'success' : 'active'}
          style={{ width: 140 }}
        />
      }
    >
      <Row gutter={[12, 12]}>
        {STAT_ITEMS.map(({ key, label, icon, colorClass }) => (
          <Col key={key} xs={12} sm={8} md={5} lg={5}>
            <Card size="small" className={`bdds-auto-stat ${colorClass}`}>
              <Statistic
                title={
                  <span className="bdds-auto-stat__label">
                    {icon}&nbsp;{label}
                  </span>
                }
                value={fmt(status[key])}
                suffix="₽"
                valueStyle={{ fontSize: 15, fontWeight: 600 }}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
};
