import { useRef, useState, useEffect } from 'react';
import type { FC } from 'react';
import { Button, Table, Tag, message, Card, Space, Statistic, Row, Col, Typography } from 'antd';
import { ReloadOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { useEtlImport } from '../../hooks/useEtlImport';
import * as etlService from '../../services/etlService';
import type { IEtlEntry } from '../../types/etl';

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: 'Ожидает' },
  routed: { color: 'green', label: 'Разнесена' },
  quarantine: { color: 'orange', label: 'Карантин' },
  manual: { color: 'blue', label: 'Вручную' },
};

const DOC_TYPE_MAP: Record<string, string> = {
  receipt: 'Поступление',
  debt_correction: 'Корр. долга (РП)',
  other: 'Прочее',
};

export const EtlImportTab: FC = () => {
  const { importing, lastResult, error, importFile } = useEtlImport();
  const [entries, setEntries] = useState<IEtlEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadEntries = async () => {
    setLoadingEntries(true);
    try {
      const data = await etlService.getEntries();
      setEntries(data);
    } catch {
      message.error('Ошибка загрузки');
    } finally {
      setLoadingEntries(false);
    }
  };

  useEffect(() => { loadEntries(); }, []);
  useEffect(() => { if (lastResult) loadEntries(); }, [lastResult]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importFile(file);
    if (result) {
      message.success(
        `Импорт: ${result.total} проводок, ${result.routed} разнесено, ${result.quarantine} в карантине`
      );
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const columns = [
    {
      title: 'Дата',
      dataIndex: 'doc_date',
      key: 'doc_date',
      width: 90,
      render: (v: string) => v ? new Date(v).toLocaleDateString('ru-RU') : '—',
    },
    {
      title: 'Тип',
      dataIndex: 'doc_type',
      key: 'doc_type',
      width: 130,
      render: (v: string) => DOC_TYPE_MAP[v] || v,
    },
    {
      title: 'Сумма',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      align: 'right' as const,
      render: (v: number) => v?.toLocaleString('ru-RU', { minimumFractionDigits: 2 }),
    },
    {
      title: 'Контрагент',
      dataIndex: 'counterparty_name',
      key: 'counterparty_name',
      ellipsis: true,
    },
    {
      title: 'Договор',
      dataIndex: 'contract_name',
      key: 'contract_name',
      ellipsis: true,
    },
    {
      title: 'Дт счёт',
      dataIndex: 'debit_account',
      key: 'debit_account',
      width: 70,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v: string) => {
        const s = STATUS_MAP[v] || { color: 'default', label: v };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: 'Метод',
      dataIndex: 'route_method',
      key: 'route_method',
      width: 80,
      render: (v: string | null) => v || '—',
    },
  ];

  const stats = {
    total: entries.length,
    routed: entries.filter((t) => t.status === 'routed').length,
    quarantine: entries.filter((t) => t.status === 'quarantine').length,
    manual: entries.filter((t) => t.status === 'manual').length,
  };

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Всего" value={stats.total} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Разнесено" value={stats.routed} styles={{ content: { color: '#52c41a' } }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Карантин" value={stats.quarantine} styles={{ content: { color: '#fa8c16' } }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Вручную" value={stats.manual} styles={{ content: { color: '#1890ff' } }} /></Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 16 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden-input"
          onChange={handleFileChange}
        />
        <Button
          type="primary"
          icon={<CloudUploadOutlined />}
          loading={importing}
          onClick={() => fileInputRef.current?.click()}
        >
          Импорт карточки сч. 62
        </Button>
        <Button icon={<ReloadOutlined />} onClick={loadEntries} loading={loadingEntries}>
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
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `Всего: ${t}` }}
        loading={loadingEntries}
        scroll={{ x: 900 }}
      />
    </div>
  );
};
