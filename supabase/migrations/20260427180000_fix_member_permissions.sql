-- FIX: Permissões do role "USER" (Membro)
-- Problema: Usuários com role "USER" não conseguiam adicionar itens nem visualizar quadros da equipe
-- Causa raiz: A migração de security_hardening restringiu tabelas demais para ADMIN-only
-- Solução: Permitir que qualquer usuário autenticado possa operar no sistema normalmente
-- Apenas funcionalidades administrativas (gerenciar usuários, logs, configurações sensíveis) ficam restritas

-- ===========================================================================
-- 1. SETTINGS TABLE: Permitir leitura para todos (logo, banner, configs visuais)
--    Apenas ADMINs podem ESCREVER em settings, mas todos podem LER.
-- ===========================================================================
DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;

CREATE POLICY "Authenticated users can read settings"
  ON public.settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can write settings"
  ON public.settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update settings"
  ON public.settings FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete settings"
  ON public.settings FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ===========================================================================
-- 2. EMPLOYEES TABLE: Permitir que membros (USER) criem/editem/excluam funcionários
--    Anteriormente só ADMIN podia gerenciar (is_admin())
-- ===========================================================================
DROP POLICY IF EXISTS "Admins can manage employees" ON public.employees;

CREATE POLICY "Authenticated users can manage employees"
  ON public.employees FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update employees"
  ON public.employees FOR UPDATE
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete employees"
  ON public.employees FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');

-- ===========================================================================
-- 3. CREDENTIALS TABLE: Permitir leitura e escrita para membros, não apenas admin
--    Membros precisam acessar o Banco de Dados (Cofre)
-- ===========================================================================
DROP POLICY IF EXISTS "Admins can manage credentials" ON public.credentials;

CREATE POLICY "Authenticated users can manage credentials"
  ON public.credentials FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ===========================================================================
-- 4. KANBAN_CARDS: Permitir que membros (USER) também possam deletar cards
--    Anteriormente só ADMIN podia DELETE
-- ===========================================================================
DROP POLICY IF EXISTS "Admins can delete cards" ON public.kanban_cards;

CREATE POLICY "Authenticated users can delete cards"
  ON public.kanban_cards FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');

-- ===========================================================================
-- 5. PRODUCTS TABLE: Permitir que membros (USER) gerenciem produtos completos
--    Anteriormente só SELECT era permitido
-- ===========================================================================
DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;

CREATE POLICY "Authenticated users can manage products"
  ON public.products FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ===========================================================================
-- 6. STORAGE: Garantir que membros possam fazer upload de assets
-- ===========================================================================

-- Upload para kanban-assets
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated user upload kanban assets" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Authenticated user upload kanban assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'kanban-assets');

-- Update de kanban-assets
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated user update kanban assets" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Authenticated user update kanban assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'kanban-assets');

-- Delete de kanban-assets
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated user delete kanban assets" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Authenticated user delete kanban assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'kanban-assets');

-- Upload para product-images
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated user upload product images" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Authenticated user upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- ===========================================================================
-- 7. SYSTEM_USERS: Garantir que colunas client_link e kanban_link existem
-- ===========================================================================
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS client_link TEXT;
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS kanban_link TEXT;

-- ===========================================================================
-- 8. Atualizar a função admin_update_user_role para suportar client_link e kanban_link
--    O frontend já enviava esses parâmetros, mas a função só aceitava (user_id, role)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  target_user_id UUID,
  new_role TEXT,
  new_client_link TEXT DEFAULT NULL,
  new_kanban_link TEXT DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is admin
  IF EXISTS (SELECT 1 FROM public.system_users WHERE id = auth.uid() AND role = 'ADMIN') THEN
    UPDATE public.system_users
    SET role = new_role,
        client_link = new_client_link,
        kanban_link = new_kanban_link
    WHERE id = target_user_id;
    RETURN true;
  ELSE
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem editar usuários.';
  END IF;
END;
$$;
