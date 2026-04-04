-- =====================================================
-- MIGRAÇÃO: Adicionar colunas de IA e extras ao kanban_cards
-- Execute este SQL no SQL Editor do Supabase Dashboard
-- =====================================================

-- Colunas de IA
ALTER TABLE public.kanban_cards 
  ADD COLUMN IF NOT EXISTS ai_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_report JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS original_message TEXT DEFAULT NULL;

-- Colunas extras do card (cover, labels, checklists, comments, assigned_users)
ALTER TABLE public.kanban_cards
  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cover_image TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS checklists JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS assigned_users JSONB DEFAULT '[]'::jsonb;

-- Tabela de credenciais: adicionar calendar_client_id se não existir
ALTER TABLE public.credentials
  ADD COLUMN IF NOT EXISTS calendar_client_id TEXT DEFAULT NULL;

-- Tabela calendar_clients: adicionar campos extras se não existirem
ALTER TABLE public.calendar_clients
  ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS phones TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS address TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- Tabela system_users (para autenticação)
CREATE TABLE IF NOT EXISTS public.system_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Anyone can read system_users" ON public.system_users FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Anyone can insert system_users" ON public.system_users FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Anyone can update system_users" ON public.system_users FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "Anyone can delete system_users" ON public.system_users FOR DELETE USING (true);

-- Tabela whatsapp_inbox
CREATE TABLE IF NOT EXISTS public.whatsapp_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name TEXT,
  sender_number TEXT,
  message_text TEXT,
  message_type TEXT DEFAULT 'text',
  media_url TEXT,
  instance_name TEXT,
  remote_jid TEXT,
  raw_payload JSONB,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Anyone can read whatsapp_inbox" ON public.whatsapp_inbox FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Anyone can insert whatsapp_inbox" ON public.whatsapp_inbox FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Anyone can update whatsapp_inbox" ON public.whatsapp_inbox FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "Anyone can delete whatsapp_inbox" ON public.whatsapp_inbox FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_inbox;

-- Verificação
SELECT 'Migração concluída com sucesso!' AS resultado;
