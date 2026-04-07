import { useState, useEffect, useCallback } from 'react';
import type { FC } from 'react';
import { Table, Button, Card, Typography, Tag } from 'antd';
import { ReloadOutlined, BankOutlined } from '@ant-design/icons';
import * as bankAccountsService from '../../services/bankAccountsService';
import type { IBankAccountBalance } from '../../types/etl';

const fmtMoney = (v: number) =>
  v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const BankAccountBalances: FC = () => {
  const [balances, setBalances] = useState<IBankAccountBalance[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBalances(await bankAccountsService.getBalances());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const total = balances.reduce((s, b) => s + b.balance, 0);

  const columns = [
    {
      title: 'Расчётный счёт',
      key: 'account',
      ellipsis: true,
      render: (_: unknown, r: IBankAccountBalance) => (
        <span>
          <Typography.Text code style={{ fontSize: 11 }}>{r.account_number}</Typography.Text>
          <br />
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {r.bank_name}{r.description ? ` · ${r.description}` : ''}
          </Typography.Text>
        </span>
      ),
    },
    {
      title: 'Поступления',
      dataIndex: 'inflows',
      key: 'inflows',
      width: 130,
      align: 'right' as const,
      render: (v: number) => <span style={{ color: '#52c41a' }}>{fmtMoney(v)}</span>,
    },
    {
      title: 'Перев. вход',
      dataIndex: 'transfers_in',
      key: 'transfers_in',
      width: 130,
      align: 'right' as const,
      render: (v: number) => v > 0 ? <span style={{ color: '#1890ff' }}>+{fmtMoney(v)}</span> : '—',
    },
    {
      title: 'Перев. выход',
      dataIndex: 'transfers_out',
      key: 'transfers_out',
      width: 130,
      align: 'right' as const,
      render: (v: number) => v > 0 ? <span style={{ color: '#fa8c16' }}>−{fmtMoney(v)}</span> : '—',
    },
    {
      title: 'Остаток',
      dataIndex: 'balance',
      key: 'balance',
      width: 150,
      align: 'right' as const,
      render: (v: number) => (
        <Tag color={v > 0 ? 'green' : v < 0 ? 'red' : 'default'} style={{ fontSize: 13, fontWeight: 600 }}>
          {fmtMoney(v)}
        </Tag>
      ),
    },
  ];

  return (
    <Card
      size="small"
      title={
        <span><BankOutlined /> Остатки по расчётным счетам</span>
      }
      extra={
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Typography.Text strong style={{ fontSize: 14 }}>
            Итого: {fmtMoney(total)}
          </Typography.Text>
          <Button icon={<ReloadOutlined />} size="small" onClick={load} loading={loading} />
        </span>
      }
      style={{ marginBottom: 16 }}
    >
      <Table
        dataSource={balances}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={false}
        loading={loading}
        scroll={{ x: 700 }}
        summary={() => balances.length > 0 ? (
          <Table.Summary.Row>
            <Table.Summary.Cell index={0}>
              <Typography.Text strong>Итого ({balances.length} счетов)</Typography.Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="right">
              <Typography.Text strong style={{ color: '#52c41a' }}>
                {fmtMoney(balances.reduce((s, b) => s + b.inflows, 0))}
              </Typography.Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="right">
              <Typography.Text strong style={{ color: '#1890ff' }}>
                {fmtMoney(balances.reduce((s, b) => s + b.transfers_in, 0))}
              </Typography.Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right">
              <Typography.Text strong style={{ color: '#fa8c16' }}>
                {fmtMoney(balances.reduce((s, b) => s + b.transfers_out, 0))}
              </Typography.Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right">
              <Typography.Text strong>{fmtMoney(total)}</Typography.Text>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        ) : null}
      />
    </Card>
  );
};
