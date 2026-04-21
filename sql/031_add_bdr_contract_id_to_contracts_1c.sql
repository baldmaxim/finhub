-- Добавляет связь между 1С-договором и договором БДР
ALTER TABLE contracts_1c
  ADD COLUMN IF NOT EXISTS bdr_contract_id UUID REFERENCES bdr_contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_1c_bdr_contract_id
  ON contracts_1c(bdr_contract_id);
