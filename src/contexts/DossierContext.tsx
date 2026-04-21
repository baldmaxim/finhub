import { createContext, useContext, useMemo } from 'react';
import type { FC, ReactNode } from 'react';
import { useDossier } from '../hooks/useDossier';
import type {
  ContractDossier,
  ContractDossierFormData,
  IEffectiveDossier,
  IDossierComputedValues,
} from '../types/dossier';

interface IDossierContextValue {
  documents: ContractDossier[];
  effective: IEffectiveDossier | null;
  values: IDossierComputedValues | null;
  loading: boolean;
  saving: boolean;
  loadDossier: (projectId: string) => Promise<void>;
  clearDossier: () => void;
  saveDossier: (formData: ContractDossierFormData) => Promise<ContractDossier | null>;
  updateDossier: (id: string, formData: Partial<ContractDossierFormData>) => Promise<ContractDossier | null>;
  deleteDossier: (id: string) => Promise<void>;
}

const DossierContext = createContext<IDossierContextValue | null>(null);

const computeValues = (eff: IEffectiveDossier): IDossierComputedValues => {
  const { header, bdds } = eff.effective;
  const amount = header.contract_amount;
  const nds = header.nds_rate / 100;

  const advanceAmount = bdds.advance_amount ?? (amount * ((bdds.advance_pct ?? 0) / 100));
  const preferentialAdvanceAmount = amount * (bdds.preferential_advance_pct / 100);
  const targetAdvanceMaxAmount = amount * ((bdds.target_advance_max_pct ?? 0) / 100);
  const paymentLagDays =
    (bdds.ks2_submission_day ?? 5) +
    (bdds.ks2_acceptance_days ?? 15) +
    (bdds.ks2_payment_days ?? 15);
  const paymentLagMonths = Math.ceil(paymentLagDays / 30);

  const endDate = header.end_date ? new Date(header.end_date) : null;
  const remainingDays = endDate
    ? Math.max(0, Math.floor((endDate.getTime() - Date.now()) / 86_400_000))
    : 0;

  return {
    contractAmount: amount,
    contractAmountExVat: nds > 0 ? amount / (1 + nds) : amount,
    advanceAmount,
    preferentialAdvanceAmount,
    targetAdvanceMaxAmount,
    guHoldPct: bdds.gu_rate_pct,
    paymentLagDays,
    paymentLagMonths,
    remainingDays,
  };
};

export const DossierProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const dossier = useDossier();

  const values = useMemo(
    () => (dossier.effective ? computeValues(dossier.effective) : null),
    [dossier.effective],
  );

  const contextValue: IDossierContextValue = useMemo(
    () => ({ ...dossier, values }),
    [dossier, values],
  );

  return <DossierContext.Provider value={contextValue}>{children}</DossierContext.Provider>;
};

export const useDossierContext = (): IDossierContextValue => {
  const ctx = useContext(DossierContext);
  if (!ctx) throw new Error('useDossierContext must be used inside DossierProvider');
  return ctx;
};
