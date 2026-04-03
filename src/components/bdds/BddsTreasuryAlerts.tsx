import type { FC } from 'react';
import { Alert, notification } from 'antd';
import { useEffect, useRef } from 'react';
import { SafetyOutlined, DollarOutlined, BankOutlined } from '@ant-design/icons';
import type { IBddsKpiMetrics } from '../../hooks/useBdds';
import { MONTHS } from '../../utils/constants';

const fmt = (v: number) => v.toLocaleString('ru-RU', { maximumFractionDigits: 0 });

interface IProps {
  liquidity: IBddsKpiMetrics;
}

export const BddsTreasuryAlerts: FC<IProps> = ({ liquidity }) => {
  const { obsCloseByMonth, rsCloseByMonth, customerPaymentFact } = liquidity;
  const notifiedRef = useRef(false);

  // --- OBS Check: если на ОБС есть деньги, нельзя списывать со свободного р/с ---
  const obsProtectionMonths: string[] = [];
  for (const m of MONTHS) {
    const obs = obsCloseByMonth[m.key] || 0;
    const rs = rsCloseByMonth[m.key] || 0;
    if (obs > 0 && rs < 0) {
      obsProtectionMonths.push(m.short);
    }
  }

  // --- Profit Sweeping: если на ОБС излишек, подсказать казначею ---
  let profitSweepAmount = 0;
  const lastMonthWithObs = MONTHS.slice().reverse().find((m) => (obsCloseByMonth[m.key] || 0) > 0);
  if (lastMonthWithObs) {
    const obsEnd = obsCloseByMonth[lastMonthWithObs.key] || 0;
    const rsEnd = rsCloseByMonth[lastMonthWithObs.key] || 0;
    // Если ОБС > 0 и р/с тоже > 0, значит есть маржа на ОБС для вывода
    if (obsEnd > 0 && rsEnd >= 0) {
      profitSweepAmount = Math.min(obsEnd, obsEnd * 0.3); // макс 30% ОБС как возмещение
    }
  }

  // --- BG Tracking: если зафиксирована оплата от заказчика → toast ---
  useEffect(() => {
    if (notifiedRef.current) return;
    for (const m of MONTHS) {
      const factVal = customerPaymentFact[m.key] || 0;
      if (factVal > 0) {
        notifiedRef.current = true;
        notification.warning({
          message: 'Трекинг Банковских Гарантий',
          description: `Зафиксирована оплата от Заказчика (${m.short}): ${fmt(factVal)} ₽. Направьте уведомление в банк для снижения лимита действующей БГ.`,
          icon: <BankOutlined style={{ color: '#faad14' }} />,
          duration: 10,
          placement: 'topRight',
        });
        break;
      }
    }
  }, [customerPaymentFact]);

  // Profit Sweeping toast
  useEffect(() => {
    if (profitSweepAmount > 0) {
      notification.info({
        message: 'Вывод прибыли с ОБС',
        description: `Доступно к переводу с ОБС на р/с: ${fmt(profitSweepAmount)} ₽ в счет возмещения накладных расходов/прибыли.`,
        icon: <DollarOutlined style={{ color: '#52c41a' }} />,
        duration: 8,
        placement: 'topRight',
      });
    }
  }, [profitSweepAmount]);

  if (obsProtectionMonths.length === 0) return null;

  return (
    <Alert
      type="error"
      showIcon
      icon={<SafetyOutlined />}
      message="Защита ОБС (Hard Block)"
      description={`В месяцах ${obsProtectionMonths.join(', ')} р/с уходит в минус при наличии средств на ОБС. Целевые расходы (Материалы, СМР) должны покрываться с ОБС, а не со свободного р/с.`}
      className="mt-16"
    />
  );
};
