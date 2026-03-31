import { useState } from 'react';
import type { FC } from 'react';
import {
  Card,
  Table,
  InputNumber,
  Typography,
  Alert,
  Space,
  Tag,
  Tooltip,
} from 'antd';
import {
  WarningOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

interface IPenaltyRow {
  key: string;
  violation: string;
  rate: number;
  rateLabel: string;
  unit: string;
}

const penalties: IPenaltyRow[] = [
  {
    key: '1',
    violation: 'Просрочка промежуточных сроков СМР',
    rate: 200_000,
    rateLabel: '200 000 ₽',
    unit: 'за каждый день',
  },
  {
    key: '2',
    violation: 'Просрочка окончания СМР или получения ЗОС',
    rate: 250_000,
    rateLabel: '250 000 ₽',
    unit: 'за каждый день',
  },
  {
    key: '3',
    violation: 'Просрочка передачи квартир дольщикам',
    rate: 1_580_000,
    rateLabel: '1 580 000 ₽',
    unit: 'за каждый день',
  },
  {
    key: '4',
    violation: 'Задержка устранения дефектов по предписаниям',
    rate: 50_000,
    rateLabel: '50 000 ₽',
    unit: 'за каждый день',
  },
  {
    key: '5',
    violation: 'Смена контроля над ГП без согласования',
    rate: 1_000_000,
    rateLabel: '1 000 000 ₽',
    unit: 'за каждый случай',
  },
];

const fmt = (v: number) =>
  v.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const RiskRadarBlock: FC = () => {
  const [days, setDays] = useState<Record<string, number>>({});

  const getTotal = (key: string, rate: number) => {
    const d = days[key] ?? 0;
    return d * rate;
  };

  const columns: ColumnsType<IPenaltyRow> = [
    {
      title: 'Тип нарушения',
      dataIndex: 'violation',
      key: 'violation',
      render: (text: string) => (
        <Text strong className="dossier-risk-violation">{text}</Text>
      ),
    },
    {
      title: 'Размер штрафа',
      key: 'rate',
      width: 180,
      render: (_: unknown, record: IPenaltyRow) => (
        <Tag color="red" className="dossier-risk-rate-tag">
          {record.rateLabel} / {record.unit}
        </Tag>
      ),
    },
    {
      title: (
        <Tooltip title="Введите количество дней/случаев для расчёта потенциального убытка">
          <span>Кол-во <InfoCircleOutlined /></span>
        </Tooltip>
      ),
      key: 'days',
      width: 120,
      render: (_: unknown, record: IPenaltyRow) => (
        <InputNumber
          min={0}
          max={999}
          value={days[record.key] ?? 0}
          onChange={(v) => setDays((prev) => ({ ...prev, [record.key]: v ?? 0 }))}
          size="small"
          className="dossier-risk-input"
        />
      ),
    },
    {
      title: 'Потенциальный убыток',
      key: 'total',
      width: 200,
      render: (_: unknown, record: IPenaltyRow) => {
        const total = getTotal(record.key, record.rate);
        return (
          <Text
            strong
            className={total > 0 ? 'dossier-risk-total-danger' : 'dossier-risk-total-zero'}
          >
            {total > 0 ? `${fmt(total)} ₽` : '—'}
          </Text>
        );
      },
    },
  ];

  const grandTotal = penalties.reduce((acc, p) => acc + getTotal(p.key, p.rate), 0);

  return (
    <Card
      title={
        <Space>
          <ThunderboltOutlined className="dossier-risk-header-icon" />
          <span>Блок Г: Радар рисков — Штрафы и санкции</span>
        </Space>
      }
      className="dossier-card dossier-card--danger"
    >
      <Table
        dataSource={penalties}
        columns={columns}
        pagination={false}
        size="middle"
        className="dossier-risk-table"
        rowClassName="dossier-risk-row"
        summary={() => (
          <Table.Summary.Row className="dossier-risk-summary-row">
            <Table.Summary.Cell index={0} colSpan={3}>
              <Text strong>ИТОГО потенциальный убыток</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={1}>
              <Text
                strong
                className={grandTotal > 0 ? 'dossier-risk-total-danger' : ''}
              >
                {grandTotal > 0 ? `${fmt(grandTotal)} ₽` : '—'}
              </Text>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />

      <Alert
        type="info"
        showIcon
        icon={<WarningOutlined />}
        className="dossier-risk-alert"
        message="Встречная ответственность"
        description={
          <Text>
            Пени Заказчика за просрочку оплаты составляют <Text strong>0,05% в день</Text>.
            Внимание: начисление начинается только с <Text strong>10-го рабочего дня</Text> просрочки.
          </Text>
        }
      />
    </Card>
  );
};
