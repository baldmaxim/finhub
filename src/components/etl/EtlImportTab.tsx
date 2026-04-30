import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import type { FC } from 'react';
import { Button, Table, Tag, message, Card, Space, Statistic, Row, Col, Typography, Upload, Radio, Select, Tooltip, DatePicker, Input } from 'antd';
import { ReloadOutlined, CloudUploadOutlined, InboxOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import { useEtlImport } from '../../hooks/useEtlImport';
import * as etlService from '../../services/etlService';
import type { IEntriesPageFilters, IStatusCounts } from '../../services/etlService';
import * as bankAccountsService from '../../services/bankAccountsService';
import type { IEtlEntry, EtlSourceType, IBankAccount } from '../../types/etl';

const PAGE_SIZE_DEFAULT = 50;
const EMPTY_COUNTS: IStatusCounts = { total: 0, pending: 0, routed: 0, quarantine: 0, manual: 0 };

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
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<IStatusCounts>(EMPTY_COUNTS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [filterDates, setFilterDates] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [routingPending, setRoutingPending] = useState(false);
  const [sourceType, setSourceType] = useState<EtlSourceType>('account_51');
  const [bankAccounts, setBankAccounts] = useState<IBankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const buildFilters = useCallback((): IEntriesPageFilters => {
    const dateFrom = filterDates?.[0]?.format('YYYY-MM-DD');
    const dateTo   = filterDates?.[1]?.format('YYYY-MM-DD');
    const search   = filterSearch.trim() || undefined;
    return {
      status: filterStatus,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      search,
    };
  }, [filterStatus, filterDates, filterSearch]);

  const loadEntries = useCallback(async () => {
    setLoadingEntries(true);
    try {
      const filters = buildFilters();
      const [pageData, countsData] = await Promise.all([
        etlService.getEntriesPage(page, pageSize, filters),
        etlService.getStatusCounts({
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          search: filters.search,
        }),
      ]);
      setEntries(pageData.rows);
      setTotal(pageData.total);
      setCounts(countsData);
    } catch {
      message.error('Ошибка загрузки');
    } finally {
      setLoadingEntries(false);
    }
  }, [page, pageSize, buildFilters]);

  const loadBankAccounts = async () => {
    try {
      const data = await bankAccountsService.getActive();
      setBankAccounts(data);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => { loadBankAccounts(); }, []);
  useEffect(() => { loadEntries(); }, [loadEntries]);
  useEffect(() => { if (lastResult) loadEntries(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [lastResult]);

  // Сбрасываем страницу на 1 при смене фильтров
  useEffect(() => { setPage(1); }, [filterStatus, filterDates, filterSearch]);

  const handleRoutePending = async () => {
    setRoutingPending(true);
    try {
      const result = await etlService.routePending();
      message.success(`Прогнано pending: разнесено ${result.routed}, в карантин ${result.quarantine}`);
      await loadEntries();
    } catch (e) {
      message.error(`Ошибка маршрутизации: ${(e as Error).message}`);
    } finally {
      setRoutingPending(false);
    }
  };

  const applySearch = () => setFilterSearch(searchInput);
  const resetFilters = () => {
    setFilterStatus(undefined);
    setFilterDates(null);
    setFilterSearch('');
    setSearchInput('');
  };

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
      if (result.openingBalanceUpdate) {
        const { balance, date } = result.openingBalanceUpdate;
        const fmtBalance = balance.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const [y, m, d] = date.split('-');
        message.info(`Начальное сальдо обновлено: ${fmtBalance} ₽ на ${d}.${m}.${y}`);
      } else if (sourceType === 'account_51') {
        message.warning(
          'Начальное сальдо не определено из файла. Проверьте строку «Сальдо на начало» и дату периода в шапке карточки — баланс р/с может не сойтись с 1С.',
          8
        );
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
    total: counts.total,
    routed: counts.routed,
    quarantine: counts.quarantine,
    manual: counts.manual,
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
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
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

      <Space style={{ marginBottom: 16 }} wrap>
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
        <Tooltip title={`Прогнать ${counts.pending} pending-проводок через маршрутизацию (чанками по 2000)`}>
          <Button
            icon={<ThunderboltOutlined />}
            onClick={handleRoutePending}
            loading={routingPending}
            disabled={counts.pending === 0}
            size="small"
            type="primary"
          >
            Прогнать pending ({counts.pending})
          </Button>
        </Tooltip>
      </Space>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap size="small">
          <Select
            placeholder="Статус"
            value={filterStatus}
            onChange={(v) => setFilterStatus(v)}
            allowClear
            size="small"
            style={{ width: 160 }}
            options={[
              { value: 'pending',    label: 'Ожидает' },
              { value: 'routed',     label: 'Разнесена' },
              { value: 'quarantine', label: 'Карантин' },
              { value: 'manual',     label: 'Вручную' },
            ]}
          />
          <DatePicker.RangePicker
            size="small"
            value={filterDates as [Dayjs | null, Dayjs | null]}
            onChange={(v) => setFilterDates(v as [Dayjs | null, Dayjs | null] | null)}
            format="DD.MM.YYYY"
            allowEmpty={[true, true]}
          />
          <Input.Search
            placeholder="Контрагент / договор"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={applySearch}
            allowClear
            onClear={() => { setSearchInput(''); setFilterSearch(''); }}
            size="small"
            style={{ width: 240 }}
          />
          <Button size="small" onClick={resetFilters}>Сбросить</Button>
        </Space>
      </Card>

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
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `Всего: ${t}`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
        loading={loadingEntries}
        scroll={{ x: 1160 }}
      />
    </div>
  );
};
