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
import type { IDossierBddsData, IDossierHeaderData } from '../../types/dossier';

const { Text, Paragraph } = Typography;

const fmtAmt = (v: number) =>
  v.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

interface IProps {
  data: IDossierBddsData;
  header: IDossierHeaderData;
}

export const BddsConditionsBlock: FC<IProps> = ({ data, header }) => {
  const prefAdvanceAmount = header.contract_amount * (data.preferential_advance_pct / 100);
  const targetAdvanceMaxAmount = header.contract_amount * ((data.target_advance_max_pct ?? 0) / 100);
  const totalLagDays = data.ks2_acceptance_days + data.ks2_payment_days;
  const calendarLag = Math.round(totalLagDays * 1.4);

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
          Срок выплаты — <Text strong>{data.advance_payment_days} рабочих дней</Text> после
          выставления счёта
          {data.advance_requires_bg && (
            <>
              {' '}и предоставления{' '}
              <Tooltip title="Банковская гарантия — документ, по которому банк обязуется вернуть аванс заказчику в случае неисполнения обязательств генподрядчиком.">
                <Text strong className="dossier-term">БГ <InfoCircleOutlined /></Text>
              </Tooltip>
            </>
          )}
          .
        </Paragraph>
      </div>

      {/* Льготный аванс */}
      {data.preferential_advance_pct > 0 && (
        <div className="dossier-section">
          <div className="dossier-section-title">
            <SafetyCertificateOutlined /> Льготный аванс (без БГ)
          </div>
          <Paragraph className="dossier-section-text">
            До <Text strong>{data.preferential_advance_pct}%</Text> от суммы договора
            (<Text strong>{fmtAmt(prefAdvanceAmount)} ₽</Text>) перечисляется
            на отдельный банковский счёт
            {data.preferential_advance_bank && (
              <> в <Tag color="blue">{data.preferential_advance_bank}</Tag></>
            )}
          </Paragraph>
        </div>
      )}

      {/* Целевые авансы */}
      {(data.target_advance_max_pct ?? 0) > 0 && (
        <div className="dossier-section">
          <div className="dossier-section-title">
            <BankOutlined /> Целевые (дополнительные) авансовые платежи
          </div>
          <Paragraph className="dossier-section-text">
            Размер — не более{' '}
            <Text strong>{data.target_advance_max_pct}%</Text> от суммы договора
            {' '}(<Text strong>{fmtAmt(targetAdvanceMaxAmount)} ₽</Text>).
          </Paragraph>
          <Paragraph className="dossier-section-text">
            Назначение — исключительно для закупки{' '}
            <Text strong>материалов и оборудования</Text>.
          </Paragraph>
          {data.target_advance_to_supplier && (
            <Paragraph className="dossier-section-text">
              Платёж производится Заказчиком{' '}
              <Text strong>напрямую производителю / поставщику</Text>{' '}
              по поручению Подрядчика.
            </Paragraph>
          )}
          {data.target_advance_requires_bg === false && (
            <Tag color="blue" className="dossier-lag-tag">
              <InfoCircleOutlined /> Банковская гарантия на целевые авансы не предоставляется
            </Tag>
          )}
          {((data.target_advance_decision_days ?? 0) > 0 || (data.target_advance_payment_days ?? 0) > 0) && (
            <Paragraph className="dossier-section-text" style={{ marginTop: 8 }}>
              {(data.target_advance_decision_days ?? 0) > 0 && (
                <>Решение Заказчика — <Text strong>{data.target_advance_decision_days} раб. дней</Text>. </>
              )}
              {(data.target_advance_payment_days ?? 0) > 0 && (
                <>Оплата — <Text strong>{data.target_advance_payment_days} раб. дней</Text>.</>
              )}
            </Paragraph>
          )}
        </div>
      )}

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
              description: `до ${data.ks2_submission_day} числа месяца`,
              status: 'process',
            },
            {
              title: 'Приёмка',
              description: `${data.ks2_acceptance_days} раб. дней`,
              status: 'process',
            },
            {
              title: 'Оплата',
              description: `${data.ks2_payment_days} раб. дней`,
              status: 'process',
            },
          ]}
        />
        <Tag
          icon={<WarningOutlined />}
          color="warning"
          className="dossier-lag-tag"
        >
          Лаг поступления денег ~{calendarLag} календарных дней!
        </Tag>
      </div>

      {/* Гарантийное удержание */}
      {data.gu_rate_pct > 0 && (
        <div className="dossier-section">
          <div className="dossier-section-title">
            <SafetyCertificateOutlined />{' '}
            <Tooltip title="Часть оплаты, удерживаемая заказчиком в качестве обеспечения гарантийных обязательств генподрядчика.">
              <span className="dossier-term">Гарантийное удержание (ГУ) <InfoCircleOutlined /></span>
            </Tooltip>
          </div>
          <Paragraph className="dossier-section-text">
            Удержание живыми деньгами <Text strong>{data.gu_rate_pct}%</Text> с каждой подписанной КС-2.
          </Paragraph>
          <Paragraph className="dossier-section-text">
            Возврат — через <Text strong>{data.gu_return_months} месяцев</Text> после итогового Акта №3.
          </Paragraph>
          {data.gu_bg_replacement && (
            <Tooltip
              title={`Возможен возврат в течение ${data.gu_bg_return_days} рабочих дней при замене удержания на банковскую гарантию. Позволяет высвободить живые деньги в оборот.`}
            >
              <Tag color="green" className="dossier-optimization-tag">
                <InfoCircleOutlined /> Оптимизация ликвидности
              </Tag>
            </Tooltip>
          )}
        </div>
      )}
    </Card>
  );
};
