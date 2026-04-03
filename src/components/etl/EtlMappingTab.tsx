import { useState } from 'react';
import type { FC } from 'react';
import {
  Tabs, Table, Button, Input, Select, Space, Popconfirm, message, Modal, Form, Tag,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useEtlMapping } from '../../hooks/useEtlMapping';

const WALLET_OPTIONS = [
  { value: 'free_cash', label: 'Свободный р/с' },
  { value: 'obs', label: 'Целевой ОБС' },
];

export const EtlMappingTab: FC = () => {
  const {
    bankAccounts, contracts, cashflowItems, paymentMasks,
    projects, categories, loading,
    saveBankAccount, removeBankAccount,
    saveContract, removeContract,
    saveCashflowItem, removeCashflowItem,
    saveMask, removeMask, reload,
  } = useEtlMapping();

  const [modalType, setModalType] = useState<'bank' | 'contract' | 'cashflow' | 'mask' | null>(null);
  const [form] = Form.useForm();

  const leafCategories = categories.filter((c) => !c.is_calculated);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (modalType === 'bank') {
        await saveBankAccount(values.guid_1c, values.account_name, values.wallet_type);
      } else if (modalType === 'contract') {
        await saveContract(values.guid_1c, values.contract_name, values.counterparty_inn, values.counterparty_name, values.project_id);
      } else if (modalType === 'cashflow') {
        await saveCashflowItem(values.guid_1c, values.item_name, values.category_id);
      } else if (modalType === 'mask') {
        await saveMask({
          pattern: values.pattern,
          description: values.description,
          category_id: values.category_id,
          priority: values.priority ?? 0,
          is_active: true,
        });
      }
      message.success('Сохранено');
      setModalType(null);
      form.resetFields();
    } catch {
      // validation error
    }
  };

  // === Банковские счета ===
  const bankColumns = [
    { title: 'GUID 1С', dataIndex: 'guid_1c', key: 'guid_1c', ellipsis: true },
    { title: 'Наименование', dataIndex: 'account_name', key: 'account_name', ellipsis: true },
    {
      title: 'Тип',
      dataIndex: 'wallet_type',
      key: 'wallet_type',
      width: 140,
      render: (v: string) => (
        <Tag color={v === 'free_cash' ? 'green' : 'blue'}>
          {v === 'free_cash' ? 'Свободный р/с' : 'ОБС'}
        </Tag>
      ),
    },
    {
      title: '', key: 'action', width: 50,
      render: (_: unknown, r: { id: string }) => (
        <Popconfirm title="Удалить?" onConfirm={() => removeBankAccount(r.id)}>
          <Button danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  // === Договоры ===
  const contractColumns = [
    { title: 'GUID 1С', dataIndex: 'guid_1c', key: 'guid_1c', width: 200, ellipsis: true },
    { title: 'Договор', dataIndex: 'contract_name', key: 'contract_name', ellipsis: true },
    { title: 'ИНН', dataIndex: 'counterparty_inn', key: 'counterparty_inn', width: 120 },
    { title: 'Контрагент', dataIndex: 'counterparty_name', key: 'counterparty_name', ellipsis: true },
    {
      title: 'Проект',
      dataIndex: 'project_id',
      key: 'project_id',
      width: 150,
      render: (v: string) => projects.find((p) => p.id === v)?.name || v,
    },
    {
      title: '', key: 'action', width: 50,
      render: (_: unknown, r: { id: string }) => (
        <Popconfirm title="Удалить?" onConfirm={() => removeContract(r.id)}>
          <Button danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  // === Статьи ДДС ===
  const cashflowColumns = [
    { title: 'GUID 1С', dataIndex: 'guid_1c', key: 'guid_1c', ellipsis: true },
    { title: 'Наименование', dataIndex: 'item_name', key: 'item_name', ellipsis: true },
    {
      title: 'Категория БДДС',
      dataIndex: 'category_id',
      key: 'category_id',
      render: (v: string) => categories.find((c) => c.id === v)?.name || v,
    },
    {
      title: '', key: 'action', width: 50,
      render: (_: unknown, r: { id: string }) => (
        <Popconfirm title="Удалить?" onConfirm={() => removeCashflowItem(r.id)}>
          <Button danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  // === Маски ===
  const maskColumns = [
    { title: 'Regex', dataIndex: 'pattern', key: 'pattern', ellipsis: true },
    { title: 'Описание', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: 'Приоритет', dataIndex: 'priority', key: 'priority', width: 90 },
    {
      title: 'Категория БДДС',
      dataIndex: 'category_id',
      key: 'category_id',
      render: (v: string) => categories.find((c) => c.id === v)?.name || v,
    },
    {
      title: 'Актив.',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 70,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Да' : 'Нет'}</Tag>,
    },
    {
      title: '', key: 'action', width: 50,
      render: (_: unknown, r: { id: string }) => (
        <Popconfirm title="Удалить?" onConfirm={() => removeMask(r.id)}>
          <Button danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'bank',
      label: `Банк. счета (${bankAccounts.length})`,
      children: (
        <>
          <Space style={{ marginBottom: 8 }}>
            <Button icon={<PlusOutlined />} size="small" onClick={() => { form.resetFields(); setModalType('bank'); }}>Добавить</Button>
          </Space>
          <Table dataSource={bankAccounts} columns={bankColumns} rowKey="id" size="small" pagination={false} scroll={{ x: 600 }} />
        </>
      ),
    },
    {
      key: 'contract',
      label: `Договоры (${contracts.length})`,
      children: (
        <>
          <Space style={{ marginBottom: 8 }}>
            <Button icon={<PlusOutlined />} size="small" onClick={() => { form.resetFields(); setModalType('contract'); }}>Добавить</Button>
          </Space>
          <Table dataSource={contracts} columns={contractColumns} rowKey="id" size="small" pagination={false} scroll={{ x: 800 }} />
        </>
      ),
    },
    {
      key: 'cashflow',
      label: `Статьи ДДС (${cashflowItems.length})`,
      children: (
        <>
          <Space style={{ marginBottom: 8 }}>
            <Button icon={<PlusOutlined />} size="small" onClick={() => { form.resetFields(); setModalType('cashflow'); }}>Добавить</Button>
          </Space>
          <Table dataSource={cashflowItems} columns={cashflowColumns} rowKey="id" size="small" pagination={false} scroll={{ x: 600 }} />
        </>
      ),
    },
    {
      key: 'mask',
      label: `Маски (${paymentMasks.length})`,
      children: (
        <>
          <Space style={{ marginBottom: 8 }}>
            <Button icon={<PlusOutlined />} size="small" onClick={() => { form.resetFields(); setModalType('mask'); }}>Добавить</Button>
          </Space>
          <Table dataSource={paymentMasks} columns={maskColumns} rowKey="id" size="small" pagination={false} scroll={{ x: 700 }} />
        </>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={reload} loading={loading} size="small">
          Обновить
        </Button>
      </Space>

      <Tabs items={tabItems} size="small" />

      <Modal
        open={modalType !== null}
        title={
          modalType === 'bank' ? 'Банковский счёт' :
          modalType === 'contract' ? 'Договор' :
          modalType === 'cashflow' ? 'Статья ДДС' :
          'Маска назначения платежа'
        }
        onOk={handleSave}
        onCancel={() => { setModalType(null); form.resetFields(); }}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical" size="small">
          {modalType === 'bank' && (
            <>
              <Form.Item name="guid_1c" label="GUID 1С" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="account_name" label="Наименование счёта">
                <Input />
              </Form.Item>
              <Form.Item name="wallet_type" label="Тип кошелька" rules={[{ required: true }]}>
                <Select options={WALLET_OPTIONS} />
              </Form.Item>
            </>
          )}
          {modalType === 'contract' && (
            <>
              <Form.Item name="guid_1c" label="GUID 1С" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="contract_name" label="Наименование договора">
                <Input />
              </Form.Item>
              <Form.Item name="counterparty_inn" label="ИНН контрагента">
                <Input />
              </Form.Item>
              <Form.Item name="counterparty_name" label="Контрагент">
                <Input />
              </Form.Item>
              <Form.Item name="project_id" label="Проект" rules={[{ required: true }]}>
                <Select
                  showSearch
                  options={projects.map((p) => ({ value: p.id, label: p.name }))}
                  filterOption={(input, option) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
                  }
                />
              </Form.Item>
            </>
          )}
          {modalType === 'cashflow' && (
            <>
              <Form.Item name="guid_1c" label="GUID 1С" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="item_name" label="Наименование статьи">
                <Input />
              </Form.Item>
              <Form.Item name="category_id" label="Категория БДДС" rules={[{ required: true }]}>
                <Select
                  showSearch
                  options={leafCategories.map((c) => ({ value: c.id, label: c.name }))}
                  filterOption={(input, option) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
                  }
                />
              </Form.Item>
            </>
          )}
          {modalType === 'mask' && (
            <>
              <Form.Item name="pattern" label="Regex-паттерн" rules={[{ required: true }]}>
                <Input placeholder="(?i)аванс" />
              </Form.Item>
              <Form.Item name="description" label="Описание">
                <Input />
              </Form.Item>
              <Form.Item name="category_id" label="Категория БДДС" rules={[{ required: true }]}>
                <Select
                  showSearch
                  options={leafCategories.map((c) => ({ value: c.id, label: c.name }))}
                  filterOption={(input, option) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
                  }
                />
              </Form.Item>
              <Form.Item name="priority" label="Приоритет (меньше = выше)">
                <Input type="number" defaultValue={0} />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
};
