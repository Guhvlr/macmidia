-- ============================================================
-- Tabela de projetos temporários do MacOfertas
-- ============================================================
CREATE TABLE public.offer_projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  offer_date date NOT NULL DEFAULT CURRENT_DATE,
  state jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índice para busca por data (listagem do dia)
CREATE INDEX idx_offer_projects_date ON public.offer_projects (offer_date DESC);

-- RLS
ALTER TABLE public.offer_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated users" ON public.offer_projects
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- Limpeza automática diária às 03:00 AM (Brasília = UTC-3)
-- Requer extensão pg_cron habilitada no Supabase (Dashboard > Database > Extensions)
-- ============================================================
-- 1) Habilite pg_cron no painel do Supabase se ainda não estiver habilitado.
-- 2) Execute no SQL Editor:

-- SELECT cron.schedule(
--   'cleanup_offer_projects',
--   '0 6 * * *',           -- 06:00 UTC = 03:00 BRT
--   $$DELETE FROM public.offer_projects$$
-- );
