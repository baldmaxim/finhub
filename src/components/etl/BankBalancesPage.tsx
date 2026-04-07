import type { FC } from 'react';
import { Typography } from 'antd';
import { BankAccountBalances } from './BankAccountBalances';

export const BankBalancesPage: FC = () => {
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        Остатки по расчётным счетам
      </Typography.Title>
      <BankAccountBalances />
    </div>
  );
};
