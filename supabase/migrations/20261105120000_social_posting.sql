-- ═══════════════════════════════════════════════════════
-- CENTRAL DE POSTAGEM (Instagram & Facebook via Post for Me)
-- 1. Campos de Instagram, Facebook e Horário Padrão no cadastro do cliente
-- 2. Tabela social_posts (fila de postagens)
-- ═══════════════════════════════════════════════════════

-- 1. Instagram, Facebook e Horário Padrão no cliente
ALTER TABLE public.calendar_clients
  ADD COLUMN IF NOT EXISTS instagram_username TEXT,
  ADD COLUMN IF NOT EXISTS postforme_account_id TEXT,
  ADD COLUMN IF NOT EXISTS instagram_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS facebook_page_name TEXT,
  ADD COLUMN IF NOT EXISTS postforme_facebook_account_id TEXT,
  ADD COLUMN IF NOT EXISTS default_post_time TEXT;

-- 2. Fila de postagens
CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kanban_card_id UUID REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  calendar_client_id TEXT REFERENCES public.calendar_clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'para_postar'
    CHECK (status IN ('para_postar', 'programado', 'publicando', 'erro', 'postado')),
  placement TEXT NOT NULL DEFAULT 'feed'
    CHECK (placement IN ('feed', 'stories', 'reels')),
  media JSONB NOT NULL DEFAULT '[]'::jsonb,
  feed_media JSONB NOT NULL DEFAULT '[]'::jsonb,
  stories_media JSONB NOT NULL DEFAULT '[]'::jsonb,
  caption TEXT NOT NULL DEFAULT '',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  provider TEXT NOT NULL DEFAULT 'postforme',
  provider_post_id TEXT,
  permalink TEXT,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS feed_media JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS stories_media JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_social_posts_status ON public.social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_client ON public.social_posts(calendar_client_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_card ON public.social_posts(kanban_card_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_provider ON public.social_posts(provider_post_id);

-- updated_at automático
CREATE OR REPLACE FUNCTION public.social_posts_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_social_posts_updated_at ON public.social_posts;
CREATE TRIGGER trg_social_posts_updated_at
  BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.social_posts_touch_updated_at();

-- RLS: acesso para toda a equipe (o sistema usa login próprio via system_users)
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view social posts" ON public.social_posts;
DROP POLICY IF EXISTS "Team can view social posts" ON public.social_posts;
CREATE POLICY "Team can view social posts"
  ON public.social_posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can insert social posts" ON public.social_posts;
DROP POLICY IF EXISTS "Team can insert social posts" ON public.social_posts;
CREATE POLICY "Team can insert social posts"
  ON public.social_posts FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update social posts" ON public.social_posts;
DROP POLICY IF EXISTS "Team can update social posts" ON public.social_posts;
CREATE POLICY "Team can update social posts"
  ON public.social_posts FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Authenticated can delete social posts" ON public.social_posts;
DROP POLICY IF EXISTS "Team can delete social posts" ON public.social_posts;
CREATE POLICY "Team can delete social posts"
  ON public.social_posts FOR DELETE USING (true);

-- Realtime (todos veem as mudanças de status na hora)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
