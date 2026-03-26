import type { FC } from 'react';
import { Row, Col, Empty, Spin } from 'antd';
import { BdrKpiCards } from './BdrKpiCards';
import { BdrCombinedAnalytics } from './BdrCombinedAnalytics';
import { BdrMarginGauge } from './BdrMarginGauge';
import { BdrWaterfallChart } from './BdrWaterfallChart';
import { BdrMarginTrendChart } from './BdrMarginTrendChart';
import type { IBdrDashboardData } from '../../../types/dashboard';

interface IProps {
  data: IBdrDashboardData | null;
  loading: boolean;
}

export const BdrDashboard: FC<IProps> = ({ data, loading }) => {
  if (loading) return <Spin size="large" className="dashboard-spin" />;
  if (!data) return <Empty description="Нет данных" />;

  return (
    <div>
      <BdrKpiCards data={data} />
      <BdrCombinedAnalytics data={data} />
      <Row gutter={16}>
        <Col xs={24} lg={16}>
          <BdrMarginTrendChart data={data} />
        </Col>
        <Col xs={24} lg={8}>
          <BdrMarginGauge data={data} />
        </Col>
      </Row>
      <BdrWaterfallChart data={data} />
    </div>
  );
};
