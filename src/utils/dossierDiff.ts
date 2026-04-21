import type { ContractDossier } from '../types/dossier';

const isSet = (v: unknown): boolean =>
  v !== undefined && v !== null && v !== '' && v !== 0;

const diff = (baseVal: unknown, amVal: unknown): boolean =>
  isSet(amVal) && amVal !== baseVal;

const fmtAmt = (v: number) => v.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
const fmtDate = (v: string) => v.split('-').reverse().join('.');

export interface IDossierChange {
  label: string;
  value: string;
  delta?: string;
}

export function computeAmendmentDiff(
  base: ContractDossier,
  am: ContractDossier,
): IDossierChange[] {
  const changes: IDossierChange[] = [];
  const h = am.header_data;
  const bh = base.header_data;
  const b = am.bdds_data;
  const bb = base.bdds_data;
  const r = am.bdr_data;
  const br = base.bdr_data;
  const p = am.penalties_data;
  const bp = base.penalties_data;

  if (diff(bh.contract_amount, h.contract_amount)) {
    const d = h.contract_amount - bh.contract_amount;
    changes.push({
      label: 'Сумма',
      value: `${fmtAmt(h.contract_amount)} ₽`,
      delta: d > 0 ? `+${fmtAmt(d)} ₽` : `${fmtAmt(d)} ₽`,
    });
  }

  if (diff(bh.end_date, h.end_date) && h.end_date) {
    changes.push({ label: 'Срок', value: `до ${fmtDate(h.end_date)}` });
  }

  if (diff(bh.start_date, h.start_date) && h.start_date) {
    changes.push({ label: 'Начало', value: fmtDate(h.start_date) });
  }

  if (diff(bh.price_type, h.price_type)) {
    changes.push({ label: 'Тип цены', value: h.price_type === 'fixed' ? 'Твёрдая' : 'Ориентировочная' });
  }

  if (diff(bb.gu_rate_pct, b.gu_rate_pct)) {
    changes.push({ label: 'ГУ', value: `${b.gu_rate_pct}%` });
  }

  if (diff(bb.ks2_payment_days, b.ks2_payment_days)) {
    changes.push({ label: 'Оплата КС', value: `${b.ks2_payment_days} дн.` });
  }

  if (diff(bb.ks2_acceptance_days, b.ks2_acceptance_days)) {
    changes.push({ label: 'Приёмка КС', value: `${b.ks2_acceptance_days} дн.` });
  }

  if (diff(bb.preferential_advance_pct, b.preferential_advance_pct)) {
    changes.push({ label: 'Льг. аванс', value: `${b.preferential_advance_pct}%` });
  }

  if (diff(bb.advance_payment_days, b.advance_payment_days)) {
    changes.push({ label: 'Срок аванса', value: `${b.advance_payment_days} дн.` });
  }

  if (diff(br.savings_gp_pct, r.savings_gp_pct)) {
    changes.push({ label: 'Экономия ГП', value: `${r.savings_gp_pct}%` });
  }

  if (diff(bp.customer_penalty_rate_pct, p.customer_penalty_rate_pct)) {
    changes.push({ label: 'Пени заказчика', value: `${p.customer_penalty_rate_pct}%/день` });
  }

  if (p.penalties?.length > 0 && p.penalties.length !== bp.penalties?.length) {
    changes.push({ label: 'Штрафы', value: `${p.penalties.length} шт.` });
  }

  return changes;
}
