import { useRef, useState, useEffect, useMemo } from 'react';
import type { FC } from 'react';
import { Button, Table, Tag, message, Card, Space, Statistic, Row, Col, Typography, Upload, Radio, Select, Tooltip } from 'antd';
import { ReloadOutlined, CloudUploadOutlined, InboxOutlined } from '@ant-design/icons';
import { useEtlImport } from '../../hooks/useEtlImport';
import * as etlService from '../../services/etlService';
import * as bankAccountsService from '../../services/bankAccountsService';
import type { IEtlEntry, EtlSourceType, IBankAccount } from '../../types/etl';

const { Dragger } = Upload;

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: 'Ожидает' },
  routed: { color: 'green', label: 'Разнесена' },
  quarantine: { color: 'orange', label: 'Карантин' },
  manual: { color: 'blue', label: 'Вручную' },
};

const DOC_TYPE_MAP: Record<string, string> = {
  receipt: 'Поступление',
  debt_correction: 'Корр. долга (РП)',
  internal_transfer: 'Внутр. перевод',
  other: 'Прочее',
};

const SOURCE_TYPE_MAP: Record<string, string> = {
  account_62: 'Сч. 62',
  account_51: 'Сч. 51',
};

export const EtlImportTab: FC = () => {
  const { importing, lastResult, error, importFile } = useEtlImport();
  const [entries, setEntries] = useState<IEtlEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [sourceType, setSourceType] = useState<EtlSourceType>('account_51');
  const [bankAccounts, setBankAccounts] = useState<IBankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
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

  const loadBankAccounts = async () => {
    try {
      const data = await bankAccountsService.getActive();
      setBankAccounts(data);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => { loadEntries(); loadBankAccounts(); }, []);
  useEffect(() => { if (lastResult) loadEntries(); }, [lastResult]);

  const handleFile = async (file: File) => {
    const result = await importFile(file, sourceType, sourceType === 'account_51' ? selectedBankAccountId : null);
    if (result) {
      message.success(
        `Импорт: ${result.total} проводок, ${result.routed} разнесено, ${result.quarantine} в карантине`
      );
      if (result.detectedBankAccount) {
        const { account_number, bank_name } = result.detectedBankAccount;
        const shortNum = `…${account_number.slice(-4)}`;
        if (result.selectedMismatch) {
          message.warning(
            `В файле указан р/с ${shortNum} (${bank_name}) — использован вместо выбранного в списке`
          );
        } else {
          message.info(`Р/с определён из файла: ${shortNum} (${bank_name})`);
        }
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const bankAccountsById = useMemo(() => {
    const map = new Map<string, IBankAccount>();
    bankAccounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [bankAccounts]);

  const formatBankAccountShort = (id: string | null): { short: string; full: string } | null => {
    if (!id) return null;
    const a = bankAccountsById.get(id);
    if (!a) return { short: '…????', full: id };
    const shortNum = `…${a.account_number.slice(-4)}`;
    const shortBank = (a.bank_name || '').split(/[\s"«]/)[0] || a.bank_name || '';
    return {
      short: shortBank ? `${shortNum} ${shortBank}` : shortNum,
      full: `${a.account_number} — ${a.bank_name}${a.bik ? ` (БИК ${a.bik})` : ''}`,
    };
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
      title: 'Источник',
      dataIndex: 'source_type',
      key: 'source_type',
      width: 80,
      render: (v: string) => <Tag>{SOURCE_TYPE_MAP[v] || v}</Tag>,
    },
    {
      title: 'Р/с',
      key: 'bank_account',
      width: 160,
      ellipsis: true,
      render: (_: unknown, row: IEtlEntry) => {
        const src = formatBankAccountShort(row.bank_account_id);
        if (!src) return '—';
        if (row.doc_type === 'internal_transfer') {
          const tgt = formatBankAccountShort(row.target_bank_account_id);
          const label = `${src.short} → ${tgt ? tgt.short : '?'}`;
          const full = `${src.full}${tgt ? `  →  ${tgt.full}` : ''}`;
          return <Tooltip title={full}>{label}</Tooltip>;
        }
        return <Tooltip title={src.full}>{src.short}</Tooltip>;
      },
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

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Radio.Group
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            size="small"
          >
            <Radio.Button value="account_51">Карточка сч. 51</Radio.Button>
            <Radio.Button value="account_62">Карточка сч. 62</Radio.Button>
          </Radio.Group>

          {sourceType === 'account_51' && (
            <Select
              placeholder="Р/с (если не определится из файла)"
              value={selectedBankAccountId}
              onChange={setSelectedBankAccountId}
              allowClear
              size="small"
              style={{ minWidth: 300 }}
              options={bankAccounts.map((a) => ({
                value: a.id,
                label: `${a.account_number} — ${a.bank_name}${a.bik ? ` (БИК ${a.bik})` : ''}`,
              }))}
              notFoundContent="Нет р/с. Добавьте в Справочниках."
            />
          )}

          <Dragger
            accept=".xlsx,.xls,.csv"
            showUploadList={false}
            disabled={importing}
            beforeUpload={(file) => {
              handleFile(file as unknown as File);
              return false;
            }}
            style={{ padding: '8px 0' }}
          >
            <p style={{ marginBottom: 4 }}>
              <InboxOutlined style={{ fontSize: 32, color: '#1890ff' }} />
            </p>
            <p style={{ fontSize: 13, marginBottom: 2 }}>
              Перетащите файл или нажмите для выбора
            </p>
            <p style={{ fontSize: 11, color: '#999' }}>
              {sourceType === 'account_51'
                ? 'Карточка счета 51 из 1С (.xlsx) — поступления на р/с'
                : 'Карточка счета 62 из 1С (.xlsx) — расчёты с заказчиками'}
            </p>
          </Dragger>
        </Space>
      </Card>

      <Space style={{ marginBottom: 16 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden-input"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <Button
          icon={<CloudUploadOutlined />}
          loading={importing}
          onClick={() => fileInputRef.current?.click()}
          size="small"
        >
          Выбрать файл
        </Button>
        <Button icon={<ReloadOutlined />} onClick={loadEntries} loading={loadingEntries} size="small">
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
        scroll={{ x: 1160 }}
      />
    </div>
  );
};
