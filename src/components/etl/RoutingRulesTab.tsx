import { useEffect, useState, useCallback } from 'react';
import type { FC } from 'react';
import {
  Table, Button, Tag, Switch, Space, Popconfirm, message,
  Modal, Form, InputNumber, Select, Input, Checkbox, Typography,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import * as etlService from '../../services/etlService';
import * as bddsService from '../../services/bddsService';
import type { IEtlRoutingRule } from '../../types/etl';
import type { BddsCategory } from '../../types/bdds';

const { Text } = Typography;

const DOC_TYPE_LABELS: Record<string, string> = {
  receipt: 'Поступление',
  debt_correction: 'Корр. долга (РП)',
  internal_transfer: 'Внутр. перевод',
  other: 'Прочее',
};

const EMPTY_RULE: Omit<IEtlRoutingRule, 'id' | 'created_at' | 'updated_at'> = {
  priority: 100,
  match_doc_type: null,
  match_is_obs: null,
  match_credit_subaccount: null,
  category_id: null,
  create_mirror_expense: false,
  skip_bdds: false,
  is_active: true,
  description: null,
};

export const RoutingRulesTab: FC = () => {
  const [rules, setRules] = useState<IEtlRoutingRule[]>([]);
  const [categories, setCategories] = useState<BddsCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<IEtlRoutingRule | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, c] = await Promise.all([
        etlService.getRoutingRules(),
        bddsService.getCategories(),
      ]);
      setRules(r);
      setCategories(c.filter((cat) => !cat.is_calculated));
    } catch {
      message.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditingRule(null);
    form.setFieldsValue({ ...EMPTY_RULE });
    setModalOpen(true);
  };

  const openEdit = (rule: IEtlRoutingRule) => {
    setEditingRule(rule);
    form.setFieldsValue({
      ...rule,
      match_doc_type: rule.match_doc_type ?? undefined,
      match_is_obs: rule.match_is_obs ?? undefined,
      match_credit_subaccount: rule.match_credit_subaccount ?? '',
      category_id: rule.category_id ?? undefined,
      description: rule.description ?? '',
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await etlService.deleteRoutingRule(id);
      message.success('Правило удалено');
      load();
    } catch {
      message.error('Ошибка удаления');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await etlService.upsertRoutingRule({
        ...(editingRule ? { id: editingRule.id } : {}),
        priority: values.priority,
        match_doc_type: values.match_doc_type ?? null,
        match_is_obs: values.match_is_obs ?? null,
        match_credit_subaccount: values.match_credit_subaccount || null,
        category_id: values.category_id ?? null,
        create_mirror_expense: values.create_mirror_expense ?? false,
        skip_bdds: values.skip_bdds ?? false,
        is_active: values.is_active ?? true,
        description: values.description || null,
      });
      message.success(editingRule ? 'Правило обновлено' : 'Правило добавлено');
      setModalOpen(false);
      load();
    } catch {
      message.error('Ошибка сохранения');
    }
  };

  const toggleActive = async (rule: IEtlRoutingRule) => {
    try {
      await etlService.upsertRoutingRule({ ...rule, is_active: !rule.is_active });
      load();
    } catch {
      message.error('Ошибка');
    }
  };

  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const columns = [
    {
      title: 'Приор.',
      dataIndex: 'priority',
      key: 'priority',
      width: 70,
      sorter: (a: IEtlRoutingRule, b: IEtlRoutingRule) => a.priority - b.priority,
    },
    {
      title: 'Тип документа',
      dataIndex: 'match_doc_type',
      key: 'match_doc_type',
      width: 150,
      render: (v: string | null) =>
        v ? <Tag>{DOC_TYPE_LABELS[v] ?? v}</Tag> : <Text type="secondary">Любой</Text>,
    },
    {
      title: 'ОБС-счёт',
      dataIndex: 'match_is_obs',
      key: 'match_is_obs',
      width: 90,
      render: (v: boolean | null) =>
        v === null ? <Text type="secondary">Любой</Text>
        : v ? <Tag color="blue">Да</Tag>
        : <Tag>Нет</Tag>,
    },
    {
      title: 'Субсчёт (Кт)',
      dataIndex: 'match_credit_subaccount',
      key: 'match_credit_subaccount',
      width: 110,
      render: (v: string | null) => v ?? <Text type="secondary">Любой</Text>,
    },
    {
      title: 'Статья БДДС',
      dataIndex: 'category_id',
      key: 'category_id',
      ellipsis: true,
      render: (v: string | null) => v ? catMap.get(v) ?? v : '—',
    },
    {
      title: 'Флаги',
      key: 'flags',
      width: 120,
      render: (_: unknown, r: IEtlRoutingRule) => (
        <Space size={4}>
          {r.skip_bdds && <Tag color="red">Пропуск</Tag>}
          {r.create_mirror_expense && <Tag color="orange">Зеркало</Tag>}
        </Space>
      ),
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Активно',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (v: boolean, r: IEtlRoutingRule) => (
        <Switch checked={v} size="small" onChange={() => toggleActive(r)} />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: unknown, r: IEtlRoutingRule) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm
            title="Удалить правило?"
            onConfirm={() => handleDelete(r.id)}
            okText="Да"
            cancelText="Нет"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<PlusOutlined />} type="primary" size="small" onClick={openAdd}>
          Добавить правило
        </Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Правила применяются по приоритету (меньше = выше). Regex-маски — запасной вариант.
        </Text>
      </Space>

      <Table
        dataSource={rules}
        columns={columns}
        rowKey="id"
        size="small"
        loading={loading}
        pagination={false}
        scroll={{ x: 900 }}
        defaultSortOrder="ascend"
      />

      <Modal
        title={editingRule ? 'Редактировать правило' : 'Новое правило маршрутизации'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="Сохранить"
        cancelText="Отмена"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item name="priority" label="Приоритет" rules={[{ required: true }]}>
            <InputNumber min={1} max={9999} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="description" label="Описание">
            <Input placeholder="Краткое описание правила" />
          </Form.Item>

          <Form.Item name="match_doc_type" label="Тип документа (условие)">
            <Select allowClear placeholder="Любой тип">
              {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="match_is_obs" label="ОБС-счёт (условие)">
            <Select allowClear placeholder="Не важно">
              <Select.Option value={true}>Да (ОБС-счёт)</Select.Option>
              <Select.Option value={false}>Нет (обычный р/с)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="match_credit_subaccount" label="Субсчёт Кт (начало поля, напр. «62.01»)">
            <Input placeholder="Оставьте пустым = любой субсчёт" />
          </Form.Item>

          <Form.Item name="category_id" label="Статья БДДС">
            <Select
              allowClear
              showSearch
              placeholder="Выберите статью"
              optionFilterProp="label"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>

          <Form.Item name="skip_bdds" valuePropName="checked" label=" ">
            <Checkbox>Пропустить БДДС (не писать факт — для внутренних переводов)</Checkbox>
          </Form.Item>

          <Form.Item name="create_mirror_expense" valuePropName="checked" label=" ">
            <Checkbox>Создать зеркальный расход (для РП: доход + расход = 0)</Checkbox>
          </Form.Item>

          <Form.Item name="is_active" valuePropName="checked" label=" ">
            <Checkbox>Правило активно</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
