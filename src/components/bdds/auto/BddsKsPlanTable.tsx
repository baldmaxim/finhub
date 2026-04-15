import { FC, useState } from 'react';
import {
  Table, Button, InputNumber, Select, Popconfirm, Space, Typography, Form, Tag, Tooltip,
} from 'antd';
import { PlusOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { IKsPlanRowCalc, IKsPlanFormValues } from '../../../types/bddsAuto';

const MONTH_NAMES = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

function fmt(n: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n);
}

interface IProps {
  projectId: string;
  year: number;
  rows: IKsPlanRowCalc[];
  guRatePct: number;
  prefAdvancePct: number;
  lagMonths: number;
  onSave: (values: IKsPlanFormValues) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

interface IAddForm {
  month: number;
  ks_amount: number;
  a_remaining: number;
  w_remaining: number;
}

const USED_MONTHS = (rows: IKsPlanRowCalc[]) => new Set(rows.map((r) => r.month));

export const BddsKsPlanTable: FC<IProps> = ({
  projectId, year, rows, guRatePct, prefAdvancePct, lagMonths, onSave, onDelete,
}) => {
  const [form] = Form.useForm<IAddForm>();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const usedMonths = USED_MONTHS(rows);

  const handleAdd = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await onSave({
        project_id: projectId,
        year,
        month: values.month,
        ks_amount: values.ks_amount,
        a_remaining: values.a_remaining ?? 0,
        w_remaining: values.w_remaining ?? 0,
      });
      form.resetFields();
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<IKsPlanRowCalc> = [
    {
      title: 'Месяц',
      dataIndex: 'month',
      width: 70,
      render: (m: number) => MONTH_NAMES[m - 1],
    },
    {
      title: 'КС-2 план',
      dataIndex: 'ks_amount',
      width: 130,
      align: 'right',
      render: (v: number) => fmt(v),
    },
    {
      title: (
        <Tooltip title="Остаток нецелевого аванса на начало периода">
          А<sub>ост</sub>&nbsp;<InfoCircleOutlined />
        </Tooltip>
      ),
      dataIndex: 'a_remaining',
      width: 120,
      align: 'right',
      render: (v: number) => fmt(v),
    },
    {
      title: (
        <Tooltip title="Стоимость невыполненных работ">
          W<sub>рем</sub>&nbsp;<InfoCircleOutlined />
        </Tooltip>
      ),
      dataIndex: 'w_remaining',
      width: 120,
      align: 'right',
      render: (v: number) => fmt(v),
    },
    {
      title: `Зачет ЦА (${prefAdvancePct}%)`,
      dataIndex: 'offset_target',
      width: 120,
      align: 'right',
      render: (v: number) => <Typography.Text type="secondary">{fmt(v)}</Typography.Text>,
    },
    {
      title: 'Зачет НЦА',
      dataIndex: 'offset_nontarget',
      width: 110,
      align: 'right',
      render: (v: number) => <Typography.Text type="secondary">{fmt(v)}</Typography.Text>,
    },
    {
      title: `ГУ (${guRatePct}%)`,
      dataIndex: 'gu_amount',
      width: 110,
      align: 'right',
      render: (v: number) => <Typography.Text type="danger">{fmt(v)}</Typography.Text>,
    },
    {
      title: 'Нетто к получению',
      dataIndex: 'net_cash',
      width: 145,
      align: 'right',
      render: (v: number) => (
        <Typography.Text strong style={{ color: v > 0 ? '#52c41a' : '#ff4d4f' }}>
          {fmt(v)}
        </Typography.Text>
      ),
    },
    {
      title: `Дата оплаты (лаг ${lagMonths} мес.)`,
      width: 160,
      align: 'center',
      render: (_, r) => (
        <Tag color="blue">
          {MONTH_NAMES[r.pay_month - 1]}&nbsp;{r.pay_year}
        </Tag>
      ),
    },
    {
      title: '',
      width: 48,
      align: 'center',
      render: (_, r) => (
        <Popconfirm title="Удалить строку?" onConfirm={() => onDelete(r.id)} okText="Да" cancelText="Нет">
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="bdds-ks-plan-wrapper">
      <Table<IKsPlanRowCalc>
        dataSource={rows}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 1100 }}
        summary={(data) => {
          const totalKs  = data.reduce((s, r) => s + r.ks_amount, 0);
          const totalNet = data.reduce((s, r) => s + r.net_cash, 0);
          const totalGu  = data.reduce((s, r) => s + r.gu_amount, 0);
          return (
            <Table.Summary.Row className="bdds-summary-row">
              <Table.Summary.Cell index={0}><strong>Итого</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right"><strong>{fmt(totalKs)}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={2} />
              <Table.Summary.Cell index={3} />
              <Table.Summary.Cell index={4} />
              <Table.Summary.Cell index={5} />
              <Table.Summary.Cell index={6} align="right">
                <Typography.Text type="danger"><strong>{fmt(totalGu)}</strong></Typography.Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={7} align="right">
                <Typography.Text strong style={{ color: '#52c41a' }}>{fmt(totalNet)}</Typography.Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={8} />
              <Table.Summary.Cell index={9} />
            </Table.Summary.Row>
          );
        }}
      />

      {adding ? (
        <Form form={form} layout="inline" className="bdds-ks-add-form">
          <Form.Item name="month" rules={[{ required: true, message: '' }]}>
            <Select
              placeholder="Месяц"
              style={{ width: 90 }}
              options={MONTH_NAMES.map((name, i) => ({
                value: i + 1,
                label: name,
                disabled: usedMonths.has(i + 1),
              }))}
            />
          </Form.Item>
          <Form.Item name="ks_amount" rules={[{ required: true, message: '' }]}>
            <InputNumber placeholder="Сумма КС" min={0} style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="a_remaining">
            <InputNumber placeholder="А ост." min={0} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="w_remaining">
            <InputNumber placeholder="W рем." min={0} style={{ width: 120 }} />
          </Form.Item>
          <Space>
            <Button type="primary" onClick={handleAdd} loading={saving}>Добавить</Button>
            <Button onClick={() => setAdding(false)}>Отмена</Button>
          </Space>
        </Form>
      ) : (
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => setAdding(true)}
          className="bdds-ks-add-btn"
        >
          Добавить период КС
        </Button>
      )}
    </div>
  );
};
