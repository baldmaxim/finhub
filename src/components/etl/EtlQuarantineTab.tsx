import { useState } from 'react';
import type { FC } from 'react';
import { Table, Select, Button, Tag, Checkbox, Space, message, Typography } from 'antd';
import { CheckOutlined, ReloadOutlined } from '@ant-design/icons';
import { useEtlQuarantine } from '../../hooks/useEtlQuarantine';
import type { IEtlEntry } from '../../types/etl';

interface IResolveState {
  projectId: string | null;
  categoryId: string | null;
  saveRule: boolean;
}

export const EtlQuarantineTab: FC = () => {
  const { entries, projects, categories, loading, error, resolveEntry, reload } = useEtlQuarantine();
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

  const handleResolve = async (entryId: string) => {
    const state = getState(entryId);
    if (!state.projectId || !state.categoryId) {
      message.warning('Выберите проект и статью БДДС');
      return;
    }
    setResolving(entryId);
    try {
      await resolveEntry(entryId, state.projectId, state.categoryId, state.saveRule);
      message.success('Проводка разнесена');
      setResolveStates((prev) => {
        const next = { ...prev };
        delete next[entryId];
        return next;
      });
    } catch {
      message.error('Ошибка при разнесении');
    } finally {
      setResolving(null);
    }
  };

  const leafCategories = categories.filter((c) => !c.is_calculated);

  const columns = [
    {
      title: 'Дата',
      dataIndex: 'doc_date',
      key: 'doc_date',
      width: 85,
      render: (v: string) => v ? new Date(v).toLocaleDateString('ru-RU') : '—',
    },
    {
      title: 'Сумма',
      dataIndex: 'amount',
      key: 'amount',
      width: 110,
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
      title: 'Договор',
      dataIndex: 'contract_name',
      key: 'contract_name',
      width: 160,
      ellipsis: true,
    },
    {
      title: 'Документ',
      dataIndex: 'document',
      key: 'document',
      ellipsis: true,
      render: (v: string | null) => (
        <Typography.Text style={{ fontSize: 11 }}>{v || '—'}</Typography.Text>
      ),
    },
    {
      title: 'Лог',
      dataIndex: 'route_log',
      key: 'route_log',
      width: 140,
      ellipsis: true,
      render: (v: string | null) => (
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>{v || '—'}</Typography.Text>
      ),
    },
    {
      title: 'Проект',
      key: 'project',
      width: 170,
      render: (_: unknown, record: IEtlEntry) => (
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
      width: 220,
      render: (_: unknown, record: IEtlEntry) => (
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
      title: 'Запомнить',
      key: 'save_rule',
      width: 80,
      render: (_: unknown, record: IEtlEntry) => (
        <Checkbox
          checked={getState(record.id).saveRule}
          onChange={(e) => updateState(record.id, { saveRule: e.target.checked })}
        />
      ),
    },
    {
      title: '',
      key: 'action',
      width: 60,
      render: (_: unknown, record: IEtlEntry) => {
        const state = getState(record.id);
        return (
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            disabled={!state.projectId || !state.categoryId}
            loading={resolving === record.id}
            onClick={() => handleResolve(record.id)}
          />
        );
      },
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Tag color="orange">{entries.length} проводок в карантине</Tag>
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
        dataSource={entries}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 20 }}
        loading={loading}
        scroll={{ x: 1400 }}
        locale={{ emptyText: 'Нет проводок в карантине' }}
      />
    </div>
  );
};
