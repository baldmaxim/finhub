import { type FC, useState, useEffect } from 'react';
import { Modal, InputNumber, message, Spin } from 'antd';
import * as fixedPlanService from '../../services/bdrFixedExpensesPlanService';
import { formatAmount } from '../../utils/formatters';

interface IProps {
  year: number;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const BdrFixedExpensesPlanModal: FC<IProps> = ({ year, open, onClose, onSaved }) => {
  const [amount, setAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fixedPlanService.getFixedExpensesPlan(year)
      .then((plan) => setAmount(plan?.amount ?? 0))
      .catch(() => message.error('Ошибка загрузки ОФЗ'))
      .finally(() => setLoading(false));
  }, [year, open]);

  const handleOk = async () => {
    try {
      setSaving(true);
      console.log('[ОФЗ модалка] сохраняю', { year, amount });
      await fixedPlanService.upsertFixedExpensesPlan(year, amount);
      message.success('ОФЗ сохранён');
      onSaved();
      onClose();
    } catch (err) {
      console.error('ОФЗ save error:', err);
      message.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const monthly = amount / 12;

  return (
    <Modal
      title={`ОФЗ факт на ${year} год`}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={saving}
      width={420}
    >
      {loading ? (
        <Spin />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>Годовая сумма ОФЗ (факт)</div>
            <InputNumber
              value={amount}
              onChange={(v) => setAmount(v ?? 0)}
              style={{ width: '100%' }}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
              parser={(v) => Number((v || '').replace(/\s/g, ''))}
              min={0}
              size="large"
            />
          </div>
          <div style={{ color: '#888' }}>
            Ежемесячно: <strong>{formatAmount(monthly)}</strong>
          </div>
        </div>
      )}
    </Modal>
  );
};
