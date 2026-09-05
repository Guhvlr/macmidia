-- Adicionar novas colunas de controle de parcelamento
ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS installment_group_id UUID,
  ADD COLUMN IF NOT EXISTS installment_number INTEGER,
  ADD COLUMN IF NOT EXISTS installment_total INTEGER,
  ADD COLUMN IF NOT EXISTS original_due_day INTEGER;

-- Índice para consultas por grupo de parcelas (apenas se existir grupo)
CREATE INDEX IF NOT EXISTS idx_financial_entries_group
  ON public.financial_entries(installment_group_id)
  WHERE installment_group_id IS NOT NULL;

-- Índice único para evitar duplicação da mesma parcela no mesmo grupo
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_entries_group_number
  ON public.financial_entries(installment_group_id, installment_number)
  WHERE installment_group_id IS NOT NULL;
