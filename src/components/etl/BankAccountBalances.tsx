import { useState, useEffect, useCallback } from 'react';
import type { FC } from 'react';
import { Table, Button, Card, Typography, Tag, Spin } from 'antd';
import { ReloadOutlined, BankOutlined } from '@ant-design/icons';
import * as bankAccountsService from '../../services/bankAccountsService';
import type { IBankAccountBalance, IBankAccountMonthlyBalance } from '../../types/etl';

const fmtMoney = (v: number) =>
  v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MONTH_NAMES_RU = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];
const fmtMonth = (monthStr: string) => {
  // monthStr: 'YYYY-MM'
  const [y, m] = monthStr.split('-');
  const idx = parseInt(m, 10) - 1;
  return `${MONTH_NAMES_RU[idx] ?? m} ${y}`;
};

interface IMonthlyState {
  loading: boolean;
  data: IBankAccountMonthlyBalance[] | null;
}

const MonthlyBreakdown: FC<{ accountId: string; accountNumber: string }> = ({ accountId }) => {
  const [state, setState] = useState<IMonthlyState>({ loading: true, data: null });

  useEffect(() => {
    let cancelled = false;
    bankAccountsService
      .getMonthlyBalances(accountId)
      .then((data) => { if (!cancelled) setState({ loading: false, data }); })
      .catch(() => { if (!cancelled) setState({ loading: false, data: [] }); });
    return () => { cancelled = true; };
  }, [accountId]);

  if (state.loading) {
    return <div style={{ padding: 12, textAlign: 'center' }}><Spin size="small" /></div>;
  }
  if (!state.data || state.data.length === 0) {
    return <div style={{ padding: 12, color: '#999' }}>Нет операций по счёту за период.</div>;
  }

  const columns = [
    {
      title: 'Месяц',
      dataIndex: 'month',
      key: 'month',
      width: 100,
      render: (v: string) => <Typography.Text strong>{fmtMonth(v)}</Typography.Text>,
    },
    {
      title: 'Поступления',
      dataIndex: 'inflows',
      key: 'inflows',
      width: 130,
      align: 'right' as const,
      render: (v: number) => v > 0 ? <span style={{ color: '#52c41a' }}>{fmtMoney(v)}</span> : '—',
    },
    {
      title: 'Расходы',
      dataIndex: 'expenses',
      key: 'expenses',
      width: 130,
      align: 'right' as const,
      render: (v: number) => v > 0 ? <span style={{ color: '#cf1322' }}>−{fmtMoney(v)}</span> : '—',
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
      title: 'Оборот',
      dataIndex: 'month_delta',
      key: 'month_delta',
      width: 130,
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ color: v >= 0 ? '#52c41a' : '#cf1322' }}>
          {v >= 0 ? '+' : ''}{fmtMoney(v)}
        </span>
      ),
    },
    {
      title: 'Остаток',
      dataIndex: 'running_balance',
      key: 'running_balance',
      width: 150,
      align: 'right' as const,
      render: (v: number) => (
        <Tag color={v > 0 ? 'green' : v < 0 ? 'red' : 'default'} style={{ fontWeight: 600 }}>
          {fmtMoney(v)}
        </Tag>
      ),
    },
  ];

  return (
    <Table
      dataSource={state.data}
      columns={columns}
      rowKey="month"
      size="small"
      pagination={false}
      style={{ margin: '0 16px 8px 48px' }}
    />
  );
};

export const BankAccountBalances: FC = () => {
  const [balances, setBalances] = useState<IBankAccountBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<readonly React.Key[]>([]);

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
      title: 'Расходы',
      dataIndex: 'expenses',
      key: 'expenses',
      width: 130,
      align: 'right' as const,
      render: (v: number) => v > 0 ? <span style={{ color: '#cf1322' }}>−{fmtMoney(v)}</span> : '—',
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

  const rowExpandable = (r: IBankAccountBalance) =>
    r.inflows > 0 || r.expenses > 0 || r.transfers_in > 0 || r.transfers_out > 0;

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
        expandable={{
          expandedRowKeys: expandedKeys,
          onExpandedRowsChange: (keys) => setExpandedKeys(keys),
          rowExpandable,
          expandedRowRender: (r) => (
            <MonthlyBreakdown accountId={r.id} accountNumber={r.account_number} />
          ),
        }}
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
              <Typography.Text strong style={{ color: '#cf1322' }}>
                −{fmtMoney(balances.reduce((s, b) => s + b.expenses, 0))}
              </Typography.Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="right">
              <Typography.Text strong style={{ color: '#1890ff' }}>
                {fmtMoney(balances.reduce((s, b) => s + b.transfers_in, 0))}
              </Typography.Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="right">
              <Typography.Text strong style={{ color: '#fa8c16' }}>
                {fmtMoney(balances.reduce((s, b) => s + b.transfers_out, 0))}
              </Typography.Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={5} align="right">
              <Typography.Text strong>{fmtMoney(total)}</Typography.Text>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        ) : null}
      />
    </Card>
  );
};
