import type { FC } from 'react';
import { Tabs, Typography } from 'antd';
import { CloudUploadOutlined, ExclamationCircleOutlined, SettingOutlined, BankOutlined } from '@ant-design/icons';
import { EtlImportTab } from './EtlImportTab';
import { EtlQuarantineTab } from './EtlQuarantineTab';
import { EtlMappingTab } from './EtlMappingTab';
import { BankAccountBalances } from './BankAccountBalances';

const TAB_ITEMS = [
  {
    key: 'import',
    label: (
      <span><CloudUploadOutlined /> Импорт из 1С</span>
    ),
    children: <EtlImportTab />,
  },
  {
    key: 'balances',
    label: (
      <span><BankOutlined /> Остатки р/с</span>
    ),
    children: <BankAccountBalances />,
  },
  {
    key: 'quarantine',
    label: (
      <span><ExclamationCircleOutlined /> Карантин</span>
    ),
    children: <EtlQuarantineTab />,
  },
  {
    key: 'mapping',
    label: (
      <span><SettingOutlined /> Справочники</span>
    ),
    children: <EtlMappingTab />,
  },
];

export const EtlPage: FC = () => {
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        Шлюз 1С → БДДС
      </Typography.Title>
      <Tabs items={TAB_ITEMS} defaultActiveKey="import" />
    </div>
  );
};
