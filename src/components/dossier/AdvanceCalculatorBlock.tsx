import { useState, useMemo } from 'react';
import type { FC } from 'react';
import {
  Card,
  Row,
  Col,
  InputNumber,
  Typography,
  Divider,
  Space,
  Tooltip,
  Statistic,
} from 'antd';
import {
  CalculatorOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { AdvanceChart } from './AdvanceChart';

const { Text, Title } = Typography;

const CONTRACT_TOTAL = 15_800_000_000;

const fmt = (v: number) =>
  v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const AdvanceCalculatorBlock: FC = () => {
  const [aOst, setAOst] = useState<number>(500_000_000);
  const [wRem, setWRem] = useState<number>(10_000_000_000);
  const [wFact, setWFact] = useState<number>(400_000_000);
  const [targetMaterials, setTargetMaterials] = useState<number>(50_000_000);

  const nonTargetDeduction = useMemo(() => {
    if (!wRem || wRem === 0) return 0;
    return (aOst / wRem) * wFact;
  }, [aOst, wRem, wFact]);

  const guaranteeDeduction = useMemo(() => wFact * 0.025, [wFact]);

  const totalPayout = useMemo(
    () => wFact - nonTargetDeduction - targetMaterials - guaranteeDeduction,
    [wFact, nonTargetDeduction, targetMaterials, guaranteeDeduction],
  );

  const payoutColor = totalPayout >= 0 ? '#3f8600' : '#cf1322';

  return (
    <Card
      title={
        <Space>
          <CalculatorOutlined />
          <span>Блок Б: Калькулятор зачёта авансов (Удержания из КС-2)</span>
        </Space>
      }
      className="dossier-card"
    >
      <Row gutter={[24, 24]}>
        {/* Нецелевой аванс */}
        <Col xs={24} lg={12}>
          <div className="dossier-calc-section">
            <Title level={5}>Нецелевые авансы (пропорциональный метод)</Title>
            <Text type="secondary" className="dossier-formula">
              Зачёт = (A<sub>ост</sub> / W<sub>рем</sub>) × W<sub>факт</sub>
            </Text>

            <div className="dossier-calc-field">
              <Text className="dossier-calc-label">
                A<sub>ост</sub> — незачтённые нецелевые авансы{' '}
                <Tooltip title="Сумма выплаченных, но ещё не зачтённых нецелевых авансов на начало расчётного периода.">
                  <InfoCircleOutlined className="dossier-info-icon" />
                </Tooltip>
              </Text>
              <InputNumber
                value={aOst}
                onChange={(v) => setAOst(v ?? 0)}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                parser={(v) => Number((v ?? '').replace(/\s/g, ''))}
                className="dossier-calc-input"
                min={0}
                addonAfter="₽"
              />
            </div>

            <div className="dossier-calc-field">
              <Text className="dossier-calc-label">
                W<sub>рем</sub> — стоимость невыполненных работ{' '}
                <Tooltip title="Остаток стоимости работ по договору, которые ещё предстоит выполнить.">
                  <InfoCircleOutlined className="dossier-info-icon" />
                </Tooltip>
              </Text>
              <InputNumber
                value={wRem}
                onChange={(v) => setWRem(v ?? 0)}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                parser={(v) => Number((v ?? '').replace(/\s/g, ''))}
                className="dossier-calc-input"
                min={0}
                addonAfter="₽"
              />
            </div>

            <div className="dossier-calc-field">
              <Text className="dossier-calc-label">
                W<sub>факт</sub> — текущая КС-2 (выполнение за месяц)
              </Text>
              <InputNumber
                value={wFact}
                onChange={(v) => setWFact(v ?? 0)}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                parser={(v) => Number((v ?? '').replace(/\s/g, ''))}
                className="dossier-calc-input"
                min={0}
                addonAfter="₽"
              />
            </div>

            <div className="dossier-calc-result">
              <Text>Зачёт нецелевого аванса:</Text>
              <Text strong className="dossier-calc-value-warn">
                − {fmt(nonTargetDeduction)} ₽
              </Text>
            </div>
          </div>
        </Col>

        {/* Целевой аванс */}
        <Col xs={24} lg={12}>
          <div className="dossier-calc-section">
            <Title level={5}>Целевые авансы (прямой метод)</Title>
            <Text type="secondary" className="dossier-formula">
              Зачёт = стоимость смонтированных целевых материалов (1:1)
            </Text>

            <div className="dossier-calc-field">
              <Text className="dossier-calc-label">
                Стоимость смонтированных целевых материалов{' '}
                <Tooltip title="Удерживается 1 к 1 по факту физического использования авансированных материалов/оборудования в текущем месяце.">
                  <InfoCircleOutlined className="dossier-info-icon" />
                </Tooltip>
              </Text>
              <InputNumber
                value={targetMaterials}
                onChange={(v) => setTargetMaterials(v ?? 0)}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                parser={(v) => Number((v ?? '').replace(/\s/g, ''))}
                className="dossier-calc-input"
                min={0}
                addonAfter="₽"
              />
            </div>

            <div className="dossier-calc-result">
              <Text>Зачёт целевого аванса:</Text>
              <Text strong className="dossier-calc-value-warn">
                − {fmt(targetMaterials)} ₽
              </Text>
            </div>

            <Divider />

            <div className="dossier-calc-result">
              <Text>
                <Tooltip title="2,5% от суммы КС-2 удерживается в качестве обеспечения гарантийных обязательств.">
                  <span className="dossier-term">Гарантийное удержание (2,5%) <InfoCircleOutlined /></span>
                </Tooltip>
              </Text>
              <Text strong className="dossier-calc-value-warn">
                − {fmt(guaranteeDeduction)} ₽
              </Text>
            </div>
          </div>
        </Col>
      </Row>

      {/* Сводный итог */}
      <div className="dossier-summary-widget">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12}>
            <Statistic
              title="КС-2 за месяц (до удержаний)"
              value={wFact}
              precision={2}
              suffix="₽"
              groupSeparator=" "
            />
          </Col>
          <Col xs={24} sm={12}>
            <div className="dossier-payout-block" style={{ borderLeftColor: payoutColor }}>
              <Text type="secondary" className="dossier-payout-label">
                Итого к выплате по КС-2 «на руки»
              </Text>
              <div className="dossier-payout-value" style={{ color: payoutColor }}>
                {fmt(totalPayout)} ₽
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* График */}
      <Divider />
      <Title level={5}>Динамика погашения авансов vs Остаток бэклога</Title>
      <AdvanceChart
        contractTotal={CONTRACT_TOTAL}
        aOst={aOst}
        wRem={wRem}
        wFact={wFact}
        nonTargetDeduction={nonTargetDeduction}
      />
    </Card>
  );
};
