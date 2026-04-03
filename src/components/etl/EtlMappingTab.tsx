import { useState } from 'react';
import type { FC } from 'react';
import { Tabs, Table, Button, Input, Select, Space, Popconfirm, message, Modal, Form, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useEtlMapping } from '../../hooks/useEtlMapping';

export const EtlMappingTab: FC = () => {
  const {
    contracts, paymentMasks, projects, categories, loading,
    saveContract, removeContract, saveMask, removeMask, reload,
  } = useEtlMapping();

  const [modalType, setModalType] = useState<'contract' | 'mask' | null>(null);
  const [form] = Form.useForm();

  const leafCategories = categories.filter((c) => !c.is_calculated);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (modalType === 'contract') {
        await saveContract(values.counterparty_name, values.contract_name, values.project_id, values.note);
      } else if (modalType === 'mask') {
        await saveMask({
          pattern: values.pattern,
          description: values.description,
          category_id: values.category_id,
          priority: Number(values.priority) || 0,
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

  const contractColumns = [
    { title: 'Контрагент', dataIndex: 'counterparty_name', key: 'counterparty_name', ellipsis: true },
    { title: 'Договор', dataIndex: 'contract_name', key: 'contract_name', ellipsis: true },
    {
      title: 'Проект',
      dataIndex: 'project_id',
      key: 'project_id',
      width: 150,
      render: (v: string) => projects.find((p) => p.id === v)?.name || v,
    },
    { title: 'Примечание', dataIndex: 'note', key: 'note', width: 150, ellipsis: true },
    {
      title: '', key: 'action', width: 50,
      render: (_: unknown, r: { id: string }) => (
        <Popconfirm title="Удалить?" onConfirm={() => removeContract(r.id)}>
          <Button danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

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
      key: 'contract',
      label: `Контрагент → Проект (${contracts.length})`,
      children: (
        <>
          <Space style={{ marginBottom: 8 }}>
            <Button icon={<PlusOutlined />} size="small" onClick={() => { form.resetFields(); setModalType('contract'); }}>
              Добавить
            </Button>
          </Space>
          <Table dataSource={contracts} columns={contractColumns} rowKey="id" size="small" pagination={false} scroll={{ x: 600 }} />
        </>
      ),
    },
    {
      key: 'mask',
      label: `Маски статей (${paymentMasks.length})`,
      children: (
        <>
          <Space style={{ marginBottom: 8 }}>
            <Button icon={<PlusOutlined />} size="small" onClick={() => { form.resetFields(); setModalType('mask'); }}>
              Добавить
            </Button>
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
        title={modalType === 'contract' ? 'Связка Контрагент+Договор → Проект' : 'Маска статьи БДДС'}
        onOk={handleSave}
        onCancel={() => { setModalType(null); form.resetFields(); }}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical" size="small">
          {modalType === 'contract' && (
            <>
              <Form.Item name="counterparty_name" label="Контрагент (как в 1С)" rules={[{ required: true }]}>
                <Input placeholder="СЗ ГАЛС-ФРИДРИХА ЭНГЕЛЬСА ООО" />
              </Form.Item>
              <Form.Item name="contract_name" label="Договор (как в 1С)" rules={[{ required: true }]}>
                <Input placeholder="ДГ №165/9/2024 от 26.07.24" />
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
              <Form.Item name="note" label="Примечание">
                <Input />
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
