/** Строка планового графика КС-2 */
export interface IKsPlanEntry {
  id: string;
  project_id: string;
  year: number;
  month: number;
  ks_amount: number;
  a_remaining: number;
  w_remaining: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface IKsPlanFormValues {
  project_id: string;
  year: number;
  month: number;
  ks_amount: number;
  a_remaining: number;
  w_remaining: number;
  note?: string | null;
}

/** Результат генерации плана из досье */
export interface IBddsAutoGenResult {
  inserted: number;
  year: number;
  lag_months: number;
  total_gu_accumulated: number;
  error?: string;
}

/** Статус-бар по договору */
export interface IBddsContractStatus {
  contract_amount: number;
  advances_received: number;
  works_received: number;
  gu_returned: number;
  total_received: number;
  remaining: number;
}

/** Строка таблицы с расчётными значениями (для отображения) */
export interface IKsPlanRowCalc extends IKsPlanEntry {
  offset_target: number;
  offset_nontarget: number;
  gu_amount: number;
  net_cash: number;
  pay_month: number;
  pay_year: number;
}
