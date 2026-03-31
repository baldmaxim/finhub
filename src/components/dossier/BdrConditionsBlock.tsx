import type { FC } from 'react';
import { Card, List, Typography, Tag, Tooltip, Space } from 'antd';
import {
  PieChartOutlined,
  SwapOutlined,
  BankOutlined,
  InsuranceOutlined,
  SafetyCertificateOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface IConditionItem {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
}

const conditions: IConditionItem[] = [
  {
    icon: <PieChartOutlined className="dossier-bdr-icon dossier-bdr-icon--blue" />,
    title: 'Распределение экономии',
    description: (
      <>
        <div className="dossier-bdr-row">
          <Tag color="green">Инициатива ГП</Tag>
          <Text>20% нам / 80% Заказчику</Text>
        </div>
        <div className="dossier-bdr-row">
          <Tag color="default">Инициатива Заказчика</Tag>
          <Text>0% нам / 100% Заказчику</Text>
        </div>
      </>
    ),
  },
  {
    icon: <SwapOutlined className="dossier-bdr-icon dossier-bdr-icon--orange" />,
    title: 'Пересчёт твёрдой цены',
    description: (
      <Text>
        Допускается <Text strong>исключительно</Text> для позиций из Приложения №2.1
        при изменении рынка более чем на{' '}
        <Text strong>10%</Text>.
      </Text>
    ),
  },
  {
    icon: <BankOutlined className="dossier-bdr-icon dossier-bdr-icon--purple" />,
    title: 'Комиссии и банковские расходы',
    description: (
      <Text>
        Комиссии за ведение счетов в{' '}
        <Tooltip title="Обязательное требование договора — целевые счета открываются в ВТБ.">
          <Text strong className="dossier-term">ВТБ <InfoCircleOutlined /></Text>
        </Tooltip>
        ; расходы на выпуск{' '}
        <Tooltip title="Банковская гарантия — инструмент обеспечения обязательств перед заказчиком.">
          <Text strong className="dossier-term">БГ <InfoCircleOutlined /></Text>
        </Tooltip>{' '}
        (на авансы и ГО).
      </Text>
    ),
  },
  {
    icon: <InsuranceOutlined className="dossier-bdr-icon dossier-bdr-icon--red" />,
    title: 'Страхование',
    description: (
      <Text>
        Полис страхования{' '}
        <Tooltip title="Гражданская ответственность перед третьими лицами в связи со строительными работами.">
          <Text strong className="dossier-term">ГО <InfoCircleOutlined /></Text>
        </Tooltip>{' '}
        на сумму <Text strong>180 000 000 ₽</Text>.
      </Text>
    ),
  },
  {
    icon: <SafetyCertificateOutlined className="dossier-bdr-icon dossier-bdr-icon--green" />,
    title: 'Содержание строительной площадки',
    description: (
      <Text>
        Коммунальные услуги, ЧОП, видеонаблюдение,{' '}
        <Tooltip title="Система контроля и управления доступом с биометрической идентификацией по лицу.">
          <Text strong className="dossier-term">СКУД FaceID <InfoCircleOutlined /></Text>
        </Tooltip>.
      </Text>
    ),
  },
];

export const BdrConditionsBlock: FC = () => {
  return (
    <Card
      title={
        <Space>
          <PieChartOutlined />
          <span>Блок В: Условия БДР — Рентабельность и затраты</span>
        </Space>
      }
      className="dossier-card"
    >
      <div className="dossier-bdr-subtitle">
        <Text type="secondary">Обязательные OPEX (специфические затраты по договору)</Text>
      </div>
      <List
        itemLayout="horizontal"
        dataSource={conditions}
        renderItem={(item) => (
          <List.Item className="dossier-bdr-list-item">
            <List.Item.Meta
              avatar={item.icon}
              title={<Text strong>{item.title}</Text>}
              description={item.description}
            />
          </List.Item>
        )}
      />
    </Card>
  );
};
