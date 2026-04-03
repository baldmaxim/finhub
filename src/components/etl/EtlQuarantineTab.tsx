import { useState } from 'react';
import type { FC } from 'react';
import { Table, Select, Button, Tag, Checkbox, Space, message, Typography } from 'antd';
import { CheckOutlined, ReloadOutlined } from '@ant-design/icons';
import { useEtlQuarantine } from '../../hooks/useEtlQuarantine';
import type { IEtlTransaction } from '../../types/etl';

interface IResolveState {
  projectId: string | null;
  categoryId: string | null;
  saveRule: boolean;
}

export const EtlQuarantineTab: FC = () => {
  const { transactions, projects, categories, loading, error, resolveTransaction, reload } = useEtlQuarantine();
  const [resolveStates, setResolveStates] = useState<Record<string, IResolveState>>({});
  const [resolving, setResolving] = useState<string | null>(null);

  const getState = (id: string): IResolveState =>
    resolveStates[id] || { projectId: null, categoryId: null, saveRule: false };

  const updateState = (id: string, patch: Partial<IResolveState>) => {
    setResolveStates((prev) => ({
      ...prev,
      [id]: { ...getState(id), ...patch },
    }));
  };

  const handleResolve = async (txId: string) => {
    const state = getState(txId);
    if (!state.projectId || !state.categoryId) {
      message.warning('Выберите проект и статью БДДС');
      return;
    }
    setResolving(txId);
    try {
      await resolveTransaction(txId, state.projectId, state.categoryId, state.saveRule);
      message.success('Транзакция разнесена');
      setResolveStates((prev) => {
        const next = { ...prev };
        delete next[txId];
        return next;
      });
    } catch {
      message.error('Ошибка при разнесении');
    } finally {
      setResolving(null);
    }
  };

  // Только leaf-категории (без parent_id != null тоже подходят — берём все не-calculated)
  const leafCategories = categories.filter((c) => !c.is_calculated);

  const columns = [
    {
      title: 'Дата',
      dataIndex: 'doc_date',
      key: 'doc_date',
      width: 90,
      render: (v: string) => v ? new Date(v).toLocaleDateString('ru-RU') : '—',
    },
    {
      title: 'Сумма',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right' as const,
      render: (v: number) => v?.toLocaleString('ru-RU', { minimumFractionDigits: 2 }),
    },
    {
      title: 'Контрагент',
      dataIndex: 'counterparty_name',
      key: 'counterparty_name',
      width: 180,
      ellipsis: true,
    },
    {
      title: 'Назначение',
      dataIndex: 'payment_purpose',
      key: 'payment_purpose',
      ellipsis: true,
    },
    {
      title: 'Лог',
      dataIndex: 'route_log',
      key: 'route_log',
      width: 200,
      ellipsis: true,
      render: (v: string | null) => (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{v || '—'}</Typography.Text>
      ),
    },
    {
      title: 'Проект',
      key: 'project',
      width: 180,
      render: (_: unknown, record: IEtlTransaction) => (
        <Select
          size="small"
          placeholder="Проект"
          value={getState(record.id).projectId}
          onChange={(v) => updateState(record.id, { projectId: v })}
          style={{ width: '100%' }}
          options={projects.map((p) => ({ value: p.id, label: p.name }))}
          showSearch
          filterOption={(input, option) =>
            (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
          }
        />
      ),
    },
    {
      title: 'Статья БДДС',
      key: 'category',
      width: 250,
      render: (_: unknown, record: IEtlTransaction) => (
        <Select
          size="small"
          placeholder="Статья БДДС"
          value={getState(record.id).categoryId}
          onChange={(v) => updateState(record.id, { categoryId: v })}
          style={{ width: '100%' }}
          options={leafCategories.map((c) => ({ value: c.id, label: c.name }))}
          showSearch
          filterOption={(input, option) =>
            (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
          }
        />
      ),
    },
    {
      title: 'Правило',
      key: 'save_rule',
      width: 80,
      render: (_: unknown, record: IEtlTransaction) => (
        <Checkbox
          checked={getState(record.id).saveRule}
          onChange={(e) => updateState(record.id, { saveRule: e.target.checked })}
        >
          <Typography.Text style={{ fontSize: 11 }}>Запомнить</Typography.Text>
        </Checkbox>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 90,
      render: (_: unknown, record: IEtlTransaction) => {
        const state = getState(record.id);
        const ready = state.projectId && state.categoryId;
        return (
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            disabled={!ready}
            loading={resolving === record.id}
            onClick={() => handleResolve(record.id)}
          >
            ОК
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Tag color="orange">{transactions.length} транзакций в карантине</Tag>
        <Button icon={<ReloadOutlined />} onClick={reload} loading={loading} size="small">
          Обновить
        </Button>
      </Space>

      {error && (
        <Typography.Text type="danger" style={{ display: 'block', marginBottom: 8 }}>
          {error}
        </Typography.Text>
      )}

      <Table
        dataSource={transactions}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 20 }}
        loading={loading}
        scroll={{ x: 1400 }}
        locale={{ emptyText: 'Нет транзакций в карантине' }}
      />
    </div>
  );
};
