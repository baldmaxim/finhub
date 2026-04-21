import { useState, useCallback, type FC } from 'react';
import { Table, Tag, Button, Popconfirm, message, Modal, Tooltip } from 'antd';
import { EditOutlined, DeleteOutlined, CheckCircleOutlined, ExclamationCircleOutlined, FileAddOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { IContract1c, IContract1cEnrichData } from '../../types/contracts1c';
import { CONTRACT_1C_STATUS_LABELS, CONTRACT_1C_STATUS_COLORS } from '../../types/contracts1c';
import { CONTRACT_BDR_TYPES } from '../../types/contracts';
import type { Project } from '../../types/projects';
import { formatAmount } from '../../utils/formatters';
import { Contracts1cEnrichModal } from './Contracts1cEnrichModal';

interface IContracts1cRegistryTabProps {
  contracts: IContract1c[];
  projects: Project[];
  loading: boolean;
  onEnrich: (id: string, data: IContract1cEnrichData) => Promise<{ success: boolean; budgetMessage?: string }>;
  onRevalidate: (id: string) => Promise<{ success: boolean; budgetMessage?: string }>;
  onRemove: (id: string) => Promise<void>;
  onPushToBdr: (contract: IContract1c) => Promise<{ success: boolean; budgetMessage?: string }>;
}

export const Contracts1cRegistryTab: FC<IContracts1cRegistryTabProps> = ({
  contracts,
  projects,
  loading,
  onEnrich,
  onRevalidate,
  onRemove,
  onPushToBdr,
}) => {
  const [enrichContract, setEnrichContract] = useState<IContract1c | null>(null);
  const [saving, setSaving] = useState(false);
  const [pushingId, setPushingId] = useState<string | null>(null);

  const handleEnrich = useCallback(async (id: string, data: IContract1cEnrichData) => {
    setSaving(true);
    try {
      const result = await onEnrich(id, data);
      if (result.success) {
        message.success('Договор активирован, лимит зарезервирован');
        setEnrichContract(null);
      } else {
        Modal.warning({
          title: 'Превышен лимит БДР',
          icon: <ExclamationCircleOutlined />,
          content: result.budgetMessage,
        });
        setEnrichContract(null);
      }
    } finally {
      setSaving(false);
    }
  }, [onEnrich]);

  const handleRevalidate = useCallback(async (id: string) => {
    const result = await onRevalidate(id);
    if (result.success) {
      message.success('Лимит подтверждён, договор активирован');
    } else {
      message.error(result.budgetMessage || 'Лимит превышен');
    }
  }, [onRevalidate]);

  const handlePushToBdr = useCallback(async (contract: IContract1c) => {
    setPushingId(contract.id);
    try {
      const result = await onPushToBdr(contract);
      if (result.success) {
        message.success('Договор добавлен в раздел Договоры БДР');
      } else {
        Modal.warning({
          title: 'Превышен лимит БДР',
          icon: <ExclamationCircleOutlined />,
          content: result.budgetMessage,
        });
      }
    } finally {
      setPushingId(null);
    }
  }, [onPushToBdr]);

  const projectMap = new Map(projects.map(p => [p.id, p.name]));

  const columns: ColumnsType<IContract1c> = [
    {
      title: 'Статус',
      dataIndex: 'status',
      width: 140,
      filters: [
        { text: 'Не привязан', value: 'new' },
        { text: 'Активен', value: 'active' },
        { text: 'Превышен лимит', value: 'overlimit' },
        { text: 'Изменена сумма', value: 'amount_changed' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (v: keyof typeof CONTRACT_1C_STATUS_LABELS) => (
        <Tag color={CONTRACT_1C_STATUS_COLORS[v]}>{CONTRACT_1C_STATUS_LABELS[v]}</Tag>
      ),
    },
    { title: '№ договора', dataIndex: 'contract_number', width: 140 },
    { title: 'Контрагент', dataIndex: 'counterparty_name', width: 200, ellipsis: true },
    {
      title: 'Сумма',
      dataIndex: 'amount',
      width: 130,
      align: 'right',
      sorter: (a, b) => a.amount - b.amount,
      render: (v: number, r: IContract1c) => {
        if (r.status === 'amount_changed' && r.prev_amount !== null) {
          return (
            <Tooltip title={`Было: ${formatAmount(r.prev_amount)}`}>
              <span style={{ color: '#fa8c16', fontWeight: 600 }}>{formatAmount(v)}</span>
            </Tooltip>
          );
        }
        return formatAmount(v);
      },
    },
    {
      title: 'Проект',
      dataIndex: 'project_id',
      width: 150,
      ellipsis: true,
      render: (v: string | null) => v ? projectMap.get(v) || '—' : '—',
    },
    {
      title: 'Статья БДР',
      dataIndex: 'bdr_sub_type',
      width: 150,
      render: (v: string | null) => v ? CONTRACT_BDR_TYPES.find(t => t.value === v)?.label || v : '—',
    },
    {
      title: 'Дата',
      dataIndex: 'contract_date',
      width: 100,
      render: (v: string | null) => v ? dayjs(v).format('DD.MM.YYYY') : '—',
    },
    {
      title: 'Действия',
      width: 180,
      render: (_: unknown, r: IContract1c) => (
        <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(r.status === 'new' || r.status === 'overlimit') && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => setEnrichContract(r)}
            >
              Привязать
            </Button>
          )}
          {r.status === 'amount_changed' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleRevalidate(r.id)}
            >
              Подтвердить
            </Button>
          )}
          {r.status === 'active' && (
            r.bdr_contract_id
              ? <Tag color="green">В БДР</Tag>
              : (
                <Tooltip title="Создать договор в разделе Договоры БДР">
                  <Button
                    type="link"
                    size="small"
                    icon={<FileAddOutlined />}
                    loading={pushingId === r.id}
                    onClick={() => handlePushToBdr(r)}
                  >
                    В Договоры БДР
                  </Button>
                </Tooltip>
              )
          )}
          <Popconfirm title="Удалить договор?" onConfirm={() => onRemove(r.id)}>
            <Button type="text" size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </span>
      ),
    },
  ];

  return (
    <>
      <Table<IContract1c>
        columns={columns}
        dataSource={contracts}
        loading={loading}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 25 }}
        scroll={{ x: 'max-content' }}
        rowClassName={(r) => {
          if (r.status === 'new') return 'contracts-1c-row-new';
          if (r.status === 'amount_changed') return 'contracts-1c-row-changed';
          if (r.status === 'overlimit') return 'contracts-1c-row-overlimit';
          return '';
        }}
      />

      <Contracts1cEnrichModal
        contract={enrichContract}
        projects={projects}
        open={!!enrichContract}
        saving={saving}
        onSave={handleEnrich}
        onCancel={() => setEnrichContract(null)}
      />
    </>
  );
};
