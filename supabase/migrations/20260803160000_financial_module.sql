-- ═══════════════════════════════════════════════════════
-- FINANCIAL MODULE — Tables, RLS, Indexes
-- Individual per user (auth.uid())
-- ═══════════════════════════════════════════════════════

-- 1. Financial Categories
CREATE TABLE IF NOT EXISTS public.financial_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'saida' CHECK (type IN ('entrada', 'saida', 'ambos')),
  color TEXT NOT NULL DEFAULT '#6b7280',
  icon TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_categories_user ON public.financial_categories(user_id);

ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categories"
  ON public.financial_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
  ON public.financial_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON public.financial_categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON public.financial_categories FOR DELETE
  USING (auth.uid() = user_id);


-- 2. Financial Entries
CREATE TABLE IF NOT EXISTS public.financial_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL DEFAULT 'saida' CHECK (type IN ('entrada', 'saida')),
  category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'previsto' CHECK (status IN ('previsto', 'pago', 'atrasado', 'cancelado')),
  payment_method TEXT NOT NULL DEFAULT '' CHECK (payment_method IN ('', 'boleto', 'pix', 'cartao', 'dinheiro', 'transferencia')),
  client_name TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_months INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_entries_user ON public.financial_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_date ON public.financial_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_financial_entries_type ON public.financial_entries(user_id, type);
CREATE INDEX IF NOT EXISTS idx_financial_entries_category ON public.financial_entries(category_id);

ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own entries"
  ON public.financial_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries"
  ON public.financial_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own entries"
  ON public.financial_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own entries"
  ON public.financial_entries FOR DELETE
  USING (auth.uid() = user_id);


-- 3. Financial AI Chat History
CREATE TABLE IF NOT EXISTS public.financial_ai_chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_ai_chats_user ON public.financial_ai_chats(user_id);

ALTER TABLE public.financial_ai_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai chats"
  ON public.financial_ai_chats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai chats"
  ON public.financial_ai_chats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai chats"
  ON public.financial_ai_chats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ai chats"
  ON public.financial_ai_chats FOR DELETE
  USING (auth.uid() = user_id);
