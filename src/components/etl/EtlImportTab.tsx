import { useRef, useState, useEffect } from 'react';
import type { FC } from 'react';
import { Button, Table, Tag, message, Card, Space, Statistic, Row, Col, Typography } from 'antd';
import { ReloadOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { useEtlImport } from '../../hooks/useEtlImport';
import * as etlService from '../../services/etlService';
import type { IEtlTransaction } from '../../types/etl';

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: 'Ожидает' },
  routed: { color: 'green', label: 'Разнесена' },
  quarantine: { color: 'orange', label: 'Карантин' },
  manual: { color: 'blue', label: 'Вручную' },
};

const DOC_TYPE_MAP: Record<string, string> = {
  receipt: 'Поступление на р/с',
  debt_correction: 'Корректировка долга',
};

export const EtlImportTab: FC = () => {
  const { importing, lastResult, error, importFile } = useEtlImport();
  const [transactions, setTransactions] = useState<IEtlTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTransactions = async () => {
    setLoadingTx(true);
    try {
      const data = await etlService.getTransactions();
      setTransactions(data);
    } catch {
      message.error('Ошибка загрузки транзакций');
    } finally {
      setLoadingTx(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    if (lastResult) loadTransactions();
  }, [lastResult]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importFile(file);
    if (result) {
      message.success(
        `Импорт завершён: ${result.total} транзакций, ${result.routed} разнесено, ${result.quarantine} в карантине`
      );
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const columns = [
    {
      title: 'Дата',
      dataIndex: 'doc_date',
      key: 'doc_date',
      width: 100,
      render: (v: string) => v ? new Date(v).toLocaleDateString('ru-RU') : '—',
    },
    {
      title: 'Тип',
      dataIndex: 'doc_type',
      key: 'doc_type',
      width: 160,
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
      title: 'Назначение',
      dataIndex: 'payment_purpose',
      key: 'payment_purpose',
      ellipsis: true,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v: string) => {
        const s = STATUS_MAP[v] || { color: 'default', label: v };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: 'Метод',
      dataIndex: 'route_method',
      key: 'route_method',
      width: 100,
      render: (v: string | null) => v || '—',
    },
  ];

  const stats = {
    total: transactions.length,
    routed: transactions.filter((t) => t.status === 'routed').length,
    quarantine: transactions.filter((t) => t.status === 'quarantine').length,
    manual: transactions.filter((t) => t.status === 'manual').length,
  };

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Всего" value={stats.total} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Разнесено" value={stats.routed} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Карантин" value={stats.quarantine} valueStyle={{ color: '#fa8c16' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Вручную" value={stats.manual} valueStyle={{ color: '#1890ff' }} /></Card>
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
          Импорт из 1С (Excel)
        </Button>
        <Button icon={<ReloadOutlined />} onClick={loadTransactions} loading={loadingTx}>
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
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `Всего: ${t}` }}
        loading={loadingTx}
        scroll={{ x: 900 }}
      />
    </div>
  );
};
