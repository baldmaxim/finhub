import type { FC } from 'react';
import { Row, Col, Card, Statistic, Alert, Tooltip } from 'antd';
import { BankOutlined, LockOutlined, WarningOutlined, SafetyCertificateOutlined, AuditOutlined } from '@ant-design/icons';
import { Pie } from '@ant-design/charts';
import type { IBddsKpiMetrics } from '../../hooks/useBdds';
import { MONTHS } from '../../utils/constants';

const fmt = (v: number) => v.toLocaleString('ru-RU', { maximumFractionDigits: 0 });

interface IProps {
  liquidity: IBddsKpiMetrics;
}

export const BddsLiquidityCards: FC<IProps> = ({ liquidity }) => {
  const { rsBalance, obsBalance, rsFact, obsFact, advanceCoverageRatio, retentionGap, cashGapMonths } = liquidity;
  const totalPlan = rsBalance + obsBalance;
  const totalFact = rsFact + obsFact;

  const hasData = totalPlan !== 0 || totalFact !== 0;
  if (!hasData) return null;

  const rsValue = rsFact || rsBalance;
  const obsValue = obsFact || obsBalance;
  const isFactMode = rsFact !== 0 || obsFact !== 0;
  const rsWarning = rsValue <= 0 && obsValue > 0;

  const pieData = [
    { type: 'Р/С (свободный)', value: Math.max(rsValue, 0) },
    { type: 'ОБС (целевой)', value: Math.max(obsValue, 0) },
  ];

  const pieConfig = {
    data: pieData,
    angleField: 'value',
    colorField: 'type',
    innerRadius: 0.6,
    height: 160,
    color: ['#52c41a', '#faad14'],
    label: false as const,
    legend: { position: 'bottom' as const },
    statistic: {
      title: { content: 'Ликвидность', style: { fontSize: '12px' } },
      content: { content: fmt(rsValue + obsValue) + ' ₽', style: { fontSize: '14px' } },
    },
  };

  const acr = advanceCoverageRatio;
  const acrDanger = acr !== null && acr < 1;

  // Месяцы кассового разрыва
  const gapMonthNames = cashGapMonths.map((mk) => MONTHS.find((m) => m.key === mk)?.short || '').join(', ');

  return (
    <>
      <Row gutter={[16, 16]}>
        {/* Доступная ликвидность (р/с) */}
        <Col xs={24} md={8} lg={5}>
          <Card size="small" className={rsWarning ? 'bdds-liquidity-card bdds-liquidity-warning' : 'bdds-liquidity-card'}>
            <Statistic
              title={<><BankOutlined /> Доступная ликвидность (р/с)</>}
              value={fmt(rsValue)}
              suffix="₽"
              valueStyle={{ color: rsValue >= 0 ? '#3f8600' : '#cf1322', fontSize: 22 }}
            />
            {isFactMode && rsBalance !== 0 && (
              <div className="bdds-liquidity-plan-hint">План: {fmt(rsBalance)} ₽</div>
            )}
          </Card>
        </Col>

        {/* Связанная ликвидность (ОБС) */}
        <Col xs={24} md={8} lg={5}>
          <Card size="small" className="bdds-liquidity-card">
            <Statistic
              title={<><LockOutlined /> Связанная ликвидность (ОБС)</>}
              value={fmt(obsValue)}
              suffix="₽"
              valueStyle={{ color: '#faad14', fontSize: 22 }}
            />
            {isFactMode && obsBalance !== 0 && (
              <div className="bdds-liquidity-plan-hint">План: {fmt(obsBalance)} ₽</div>
            )}
          </Card>
        </Col>

        {/* Покрытие авансов */}
        <Col xs={24} md={8} lg={5}>
          <Tooltip title="Авансы от Заказчика (р/с + ОБС) / (Материалы + Субподряд авансы). Если < 1 — кредитуем стройку своими деньгами.">
            <Card size="small" className={`bdds-liquidity-card ${acrDanger ? 'bdds-kpi-danger' : ''}`}>
              <Statistic
                title={<><SafetyCertificateOutlined /> Покрытие авансов</>}
                value={acr !== null ? acr.toFixed(2) : '—'}
                valueStyle={{ color: acrDanger ? '#cf1322' : '#3f8600', fontSize: 22 }}
              />
              <div className="bdds-liquidity-plan-hint">
                {acrDanger ? 'Кредитуем стройку своими деньгами' : acr !== null ? 'Авансы покрывают расходы' : 'Нет данных'}
              </div>
            </Card>
          </Tooltip>
        </Col>

        {/* Баланс ГУ */}
        <Col xs={24} md={8} lg={4}>
          <Tooltip title="Накопленный возврат ГУ от Заказчика минус удержания субподрядчикам">
            <Card size="small" className="bdds-liquidity-card">
              <Statistic
                title={<><AuditOutlined /> Баланс ГУ</>}
                value={fmt(retentionGap)}
                suffix="₽"
                valueStyle={{ color: retentionGap >= 0 ? '#3f8600' : '#cf1322', fontSize: 22 }}
              />
            </Card>
          </Tooltip>
        </Col>

        {/* Pie Chart */}
        <Col xs={24} md={8} lg={5}>
          <Card size="small" className="bdds-liquidity-card">
            <Pie {...pieConfig} />
          </Card>
        </Col>
      </Row>

      {rsWarning && (
        <Alert
          type="error"
          showIcon
          icon={<WarningOutlined />}
          message="Кассовый разрыв по свободным деньгам"
          description={`Свободный кэш (р/с): ${fmt(rsValue)} ₽, при этом на ОБС заблокировано ${fmt(obsValue)} ₽. Операционные расходы не могут быть покрыты со счёта ОБС.`}
          className="mt-16"
        />
      )}

      {cashGapMonths.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message="Плановый кассовый разрыв"
          description={`Остаток на р/с уходит в минус в плановых месяцах: ${gapMonthNames}. Необходимо скорректировать план поступлений или выплат.`}
          className="mt-16 bdds-cash-gap-alert"
        />
      )}
    </>
  );
};
