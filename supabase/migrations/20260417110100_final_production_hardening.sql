-- FINAL PRODUCTION HARDENING: Blindagem de tabelas sensíveis
-- Data: 2026-04-17
-- Objetivo: Restringir acesso público que foi identificado durante a auditoria de produção.

-- 1. HARDENING: Tabela 'settings' (Chaves de API e Configurações de Sistema)
-- Apenas administradores podem gerenciar ou ler configurações sensíveis.
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read settings" ON public.settings;
DROP POLICY IF EXISTS "Anyone can upsert settings" ON public.settings;
DROP POLICY IF EXISTS "Anyone can update settings" ON public.settings;

CREATE POLICY "Admins can manage settings" 
  ON public.settings FOR ALL 
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Nota: Caso os usuários autenticados (não admins) precisem ler alguma configuração básica 
-- (como o logo do dashboard), podemos criar uma política específica para CHAVES NÃO SENSÍVEIS no futuro.
-- Por enquanto, segurança máxima.

-- 2. HARDENING: Tabelas do Gerador de Ofertas (Templates e Presets)
-- Garante que apenas usuários logados possam acessar os modelos de artes.
ALTER TABLE public.offer_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on offer_templates" ON public.offer_templates;
DROP POLICY IF EXISTS "Authenticated users can read templates" ON public.offer_templates;

CREATE POLICY "Authenticated users can manage offer_templates" 
  ON public.offer_templates FOR ALL 
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE public.offer_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on offer_presets" ON public.offer_presets;
DROP POLICY IF EXISTS "Authenticated users can read presets" ON public.offer_presets;

CREATE POLICY "Authenticated users can manage offer_presets" 
  ON public.offer_presets FOR ALL 
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 3. STORAGE SECURITY (Final Check)
-- Garante que o bucket de imagens de produtos exige autenticação para leitura.
DO $$ 
BEGIN
  -- Tentar desativar o acesso público total se existir (reforço)
  DROP POLICY IF EXISTS "Public Select" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Authenticated user select product images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'product-images');
