import type { FC } from 'react';
import { Empty, Spin } from 'antd';
import { BddsIncomeComboChart } from '../bdds/BddsIncomeComboChart';
import type { IBddsDashboardData } from '../../../types/dashboard';

interface IProps {
  data: IBddsDashboardData | null;
  loading: boolean;
}

export const BddsDashboard2: FC<IProps> = ({ data, loading }) => {
  if (loading) return <Spin size="large" className="dashboard-spin" />;
  if (!data) return <Empty description="Нет данных" />;

  return (
    <div>
      <BddsIncomeComboChart data={data} />
    </div>
  );
};
