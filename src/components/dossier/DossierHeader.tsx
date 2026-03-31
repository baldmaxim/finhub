import type { FC } from 'react';
import { Typography, Tag, Space, Row, Col, Statistic } from 'antd';
import {
  CalendarOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

export const DossierHeader: FC = () => {
  return (
    <div className="dossier-header">
      <Row justify="space-between" align="top" wrap>
        <Col xs={24} lg={16}>
          <Space align="start" size={12}>
            <FileDoneOutlined className="dossier-header-icon" />
            <div>
              <Title level={4} className="dossier-header-title">
                Финансовое досье: Договор генподряда №К14
              </Title>
              <Text type="secondary" className="dossier-header-subtitle">
                Корпус 14, Стадион «Спартак»
              </Text>
            </div>
          </Space>
        </Col>
        <Col xs={24} lg={8} className="dossier-header-status-col">
          <Tag color="green" className="dossier-status-badge">В работе</Tag>
        </Col>
      </Row>

      <Row gutter={[24, 16]} className="dossier-header-metrics">
        <Col xs={24} sm={12} md={8}>
          <Statistic
            title="Сумма договора (Выручка)"
            value={15_800_000_000}
            precision={2}
            suffix="₽"
            groupSeparator=" "
            className="dossier-stat"
          />
          <Text type="secondary" className="dossier-stat-note">
            Твёрдая цена, вкл. НДС 20%
          </Text>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <div className="dossier-stat-block">
            <Text type="secondary" className="dossier-stat-label">
              <CalendarOutlined /> Срок реализации
            </Text>
            <div className="dossier-stat-dates">
              01.05.2025 — 01.02.2028
            </div>
            <Text type="secondary" className="dossier-stat-note">
              33 месяца
            </Text>
          </div>
        </Col>
      </Row>
    </div>
  );
};
