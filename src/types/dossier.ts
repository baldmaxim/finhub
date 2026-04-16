export interface IDossierHeaderData {
  contract_name: string;
  contract_object: string;
  contract_amount: number;
  price_type: 'fixed' | 'estimated';
  nds_rate: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'suspended';
  duration_months: number;
}

export interface IDossierBddsData {
  advance_payment_days: number;
  advance_requires_bg: boolean;
  advance_pct?: number;
  advance_amount?: number;
  preferential_advance_pct: number;
  preferential_advance_bank: string;
  target_advance_max_pct?: number;
  target_advance_to_supplier?: boolean;
  target_advance_requires_bg?: boolean;
  target_advance_decision_days?: number;
  target_advance_payment_days?: number;
  advance_offset_method?: string;
  ks2_submission_day: number;
  ks2_acceptance_days: number;
  ks2_payment_days: number;
  gu_rate_pct: number;
  gu_return_months: number;
  gu_bg_replacement: boolean;
  gu_bg_return_days: number;
}

export interface IOpexItem {
  title: string;
  description: string;
}

export interface IDossierBdrData {
  savings_gp_pct: number;
  savings_customer_pct: number;
  savings_customer_init_gp_pct: number;
  savings_customer_init_pct: number;
  price_revision_threshold_pct: number;
  price_revision_appendix: string;
  insurance_go_amount: number;
  opex_items: IOpexItem[];
}

export interface IPenaltyItem {
  violation: string;
  rate: number;
  unit: string;
}

export interface IDossierPenaltiesData {
  penalties: IPenaltyItem[];
  customer_penalty_rate_pct: number;
  customer_penalty_start_day: number;
}

export type DossierDocumentType = 'contract' | 'amendment';

export interface ContractDossier {
  id: string;
  project_id: string;
  document_type: DossierDocumentType;
  document_number: string;
  document_date: string | null;
  is_active: boolean;
  header_data: IDossierHeaderData;
  bdds_data: IDossierBddsData;
  bdr_data: IDossierBdrData;
  penalties_data: IDossierPenaltiesData;
  amendment_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractDossierFormData {
  project_id: string;
  document_type: DossierDocumentType;
  document_number: string;
  document_date: string | null;
  is_active: boolean;
  header_data: IDossierHeaderData;
  bdds_data: IDossierBddsData;
  bdr_data: IDossierBdrData;
  penalties_data: IDossierPenaltiesData;
  amendment_summary?: string | null;
}

/** Эффективное (merged) досье = базовый договор + все ДС */
export interface IEffectiveDossier {
  base: ContractDossier;
  amendments: ContractDossier[];
  effective: {
    header: IDossierHeaderData;
    bdds: IDossierBddsData;
    bdr: IDossierBdrData;
    penalties: IDossierPenaltiesData;
  };
}

/** Дефолтные значения для нового договора */
export const EMPTY_HEADER: IDossierHeaderData = {
  contract_name: '',
  contract_object: '',
  contract_amount: 0,
  price_type: 'fixed',
  nds_rate: 20,
  start_date: '',
  end_date: '',
  status: 'active',
  duration_months: 0,
};

export const EMPTY_BDDS: IDossierBddsData = {
  advance_payment_days: 20,
  advance_requires_bg: true,
  preferential_advance_pct: 0,
  preferential_advance_bank: '',
  ks2_submission_day: 5,
  ks2_acceptance_days: 15,
  ks2_payment_days: 15,
  gu_rate_pct: 0,
  gu_return_months: 24,
  gu_bg_replacement: false,
  gu_bg_return_days: 10,
};

export const EMPTY_BDR: IDossierBdrData = {
  savings_gp_pct: 0,
  savings_customer_pct: 100,
  savings_customer_init_gp_pct: 0,
  savings_customer_init_pct: 100,
  price_revision_threshold_pct: 10,
  price_revision_appendix: '',
  insurance_go_amount: 0,
  opex_items: [],
};

export const EMPTY_PENALTIES: IDossierPenaltiesData = {
  penalties: [],
  customer_penalty_rate_pct: 0,
  customer_penalty_start_day: 0,
};
