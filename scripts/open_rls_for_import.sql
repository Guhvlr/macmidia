-- =====================================================
-- SCRIPT DE IMPORTAÇÃO EMERGENCIAL - Lista_Produtos.xlsx
-- Execute no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/ebvvmddizsggrqasnnvv/sql/new
--
-- PASSO 1: Limpar a base
-- PASSO 2: Abrir RLS temporariamente para importação
-- PASSO 3: Fechar RLS após importar pelo app
-- =====================================================

-- PASSO 1: Abrir permissão de INSERT para importação do script externo
DROP POLICY IF EXISTS "Allow service import" ON public.products;
CREATE POLICY "Allow service import" ON public.products 
  FOR INSERT WITH CHECK (true);

-- PASSO 2: Também permitir DELETE para a limpeza
DROP POLICY IF EXISTS "Allow service delete" ON public.products;
CREATE POLICY "Allow service delete" ON public.products 
  FOR DELETE USING (true);

SELECT 'Políticas abertas! Agora rode o script de importação no terminal.' as status;
