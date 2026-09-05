-- SECURITY ADVISOR FIXES: Resolvendo vulnerabilidades apontadas pelo Supabase
-- Gerado: 2026-04-15

-- 1. CORREÇÃO DE SEARCH PATH (Segurança de Funções)
-- Trava o caminho de busca em 'public' para evitar sequestro de execução.

-- Funções Core
ALTER FUNCTION public.is_admin() SET search_path = public;
ALTER FUNCTION public.search_products_fuzzy(text, float) SET search_path = public;
ALTER FUNCTION public.delete_old_kanban_cards() SET search_path = public;
ALTER FUNCTION public.cleanup_whatsapp_messages() SET search_path = public;

-- Funções detectadas no Security Advisor (tratamento resiliente caso não existam no arquivo local)
DO $$ 
BEGIN 
  EXECUTE 'ALTER FUNCTION public.cleanup_whatsapp_mensagens() SET search_path = public';
EXCEPTION WHEN OTHERS THEN 
  RAISE NOTICE 'Função cleanup_whatsapp_mensagens não encontrada ou já corrigida.';
END $$;

DO $$ 
BEGIN 
  EXECUTE 'ALTER FUNCTION public.delete_old_whatsapp_inbox() SET search_path = public';
EXCEPTION WHEN OTHERS THEN 
  RAISE NOTICE 'Função delete_old_whatsapp_inbox não encontrada ou já corrigida.';
END $$;

-- 2. CORREÇÃO DE RLS (Restrição de Leitura Pública)
-- Tabelas que estavam com 'USING (true)' agora exigem autenticação.

-- Tabela: produtos (Catálogo)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read products" ON public.products;
DROP POLICY IF EXISTS "Permitir leitura pública" ON public.products;
CREATE POLICY "Authenticated users can read products" 
  ON public.products FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Tabela: offer_presets
ALTER TABLE public.offer_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read presets" ON public.offer_presets;
DROP POLICY IF EXISTS "Permitir leitura pública" ON public.offer_presets;
CREATE POLICY "Authenticated users can read presets" 
  ON public.offer_presets FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Tabela: offer_templates
ALTER TABLE public.offer_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read templates" ON public.offer_templates;
DROP POLICY IF EXISTS "Permitir leitura pública" ON public.offer_templates;
CREATE POLICY "Authenticated users can read templates" 
  ON public.offer_templates FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 3. STORAGE SECURITY (Buckets)
-- Garante que download de assets exija usuário logado

-- Bucket: product-images (SELECT)
-- Nota: 'bucket_id' é uma coluna na tabela 'storage.objects'
DO $$ 
BEGIN
  -- Tentar desativar o acesso público total se existir
  DROP POLICY IF EXISTS "Public Select" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Authenticated user select product images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'product-images');

-- Bucket: kanban-assets (SELECT)
CREATE POLICY "Authenticated user select kanban assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'kanban-assets');
