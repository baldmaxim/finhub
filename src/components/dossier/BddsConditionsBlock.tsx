import type { FC } from 'react';
import { Card, Steps, Tag, Typography, Tooltip, Space } from 'antd';
import {
  BankOutlined,
  ClockCircleOutlined,
  SafetyCertificateOutlined,
  DollarOutlined,
  InfoCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;

export const BddsConditionsBlock: FC = () => {
  return (
    <Card
      title={
        <Space>
          <DollarOutlined />
          <span>Блок А: Условия БДДС — Денежные потоки и ликвидность</span>
        </Space>
      }
      className="dossier-card"
    >
      {/* Авансирование */}
      <div className="dossier-section">
        <div className="dossier-section-title">
          <BankOutlined /> Правила авансирования
        </div>
        <Paragraph className="dossier-section-text">
          Доступны{' '}
          <Tooltip title="Аванс, привязанный к закупке конкретных материалов или оборудования. Зачёт — по факту монтажа.">
            <Text strong className="dossier-term">целевые (материалы)</Text>
          </Tooltip>{' '}
          и{' '}
          <Tooltip title="Аванс на выполнение СМР общего назначения. Зачёт — пропорционально выполнению.">
            <Text strong className="dossier-term">нецелевые (СМР)</Text>
          </Tooltip>{' '}
          авансы.
        </Paragraph>
        <Paragraph className="dossier-section-text">
          Срок выплаты — <Text strong>20 рабочих дней</Text> после выставления счёта и предоставления{' '}
          <Tooltip title="Банковская гарантия — документ, по которому банк обязуется вернуть аванс заказчику в случае неисполнения обязательств генподрядчиком.">
            <Text strong className="dossier-term">БГ <InfoCircleOutlined /></Text>
          </Tooltip>.
        </Paragraph>
      </div>

      {/* Льготный аванс */}
      <div className="dossier-section">
        <div className="dossier-section-title">
          <SafetyCertificateOutlined /> Льготный аванс (без БГ)
        </div>
        <Paragraph className="dossier-section-text">
          До <Text strong>10%</Text> от суммы договора (<Text strong>1 580 000 000 ₽</Text>) перечисляется
          на отдельный банковский счёт в <Tag color="blue">ВТБ</Tag>
        </Paragraph>
      </div>

      {/* Тайминг КС-2 */}
      <div className="dossier-section">
        <div className="dossier-section-title">
          <ClockCircleOutlined /> Тайминг оплаты КС-2/КС-3
        </div>
        <Steps
          direction="horizontal"
          size="small"
          className="dossier-steps"
          items={[
            {
              title: 'Подача актов',
              description: 'до 5 числа месяца',
              status: 'process',
            },
            {
              title: 'Приёмка',
              description: '15 раб. дней',
              status: 'process',
            },
            {
              title: 'Оплата',
              description: '15 раб. дней',
              status: 'process',
            },
          ]}
        />
        <Tag
          icon={<WarningOutlined />}
          color="warning"
          className="dossier-lag-tag"
        >
          Лаг поступления денег ~45 календарных дней!
        </Tag>
      </div>

      {/* Гарантийное удержание */}
      <div className="dossier-section">
        <div className="dossier-section-title">
          <SafetyCertificateOutlined />{' '}
          <Tooltip title="Часть оплаты, удерживаемая заказчиком в качестве обеспечения гарантийных обязательств генподрядчика.">
            <span className="dossier-term">Гарантийное удержание (ГУ) <InfoCircleOutlined /></span>
          </Tooltip>
        </div>
        <Paragraph className="dossier-section-text">
          Удержание живыми деньгами <Text strong>2,5%</Text> с каждой подписанной КС-2.
        </Paragraph>
        <Paragraph className="dossier-section-text">
          Возврат — через <Text strong>24 месяца</Text> после итогового Акта №3.
        </Paragraph>
        <Tooltip title="Возможен возврат в течение 10 рабочих дней при замене удержания на банковскую гарантию. Позволяет высвободить живые деньги в оборот.">
          <Tag color="green" className="dossier-optimization-tag">
            <InfoCircleOutlined /> Оптимизация ликвидности
          </Tag>
        </Tooltip>
      </div>
    </Card>
  );
};
