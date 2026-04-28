-- CORREÇÃO DE SEGURANÇA (RLS) PARA TEMPLATES E PRESETS
-- Copie e cole este código no SQL Editor do seu painel Supabase para liberar o salvamento.

-- 1. Liberar tabela de Templates
ALTER TABLE public.offer_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated on offer_templates" ON public.offer_templates;
CREATE POLICY "Allow all for authenticated on offer_templates" ON public.offer_templates 
    FOR ALL TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- 2. Liberar tabela de Presets (Modelos)
ALTER TABLE public.offer_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated on offer_presets" ON public.offer_presets;
CREATE POLICY "Allow all for authenticated on offer_presets" ON public.offer_presets 
    FOR ALL TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- 3. Garantir que as tabelas aceitem IDs arbitrários (UUIDs)
ALTER TABLE public.offer_templates ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.offer_presets ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 4. Dar permissão de uso para o role authenticated
GRANT ALL ON public.offer_templates TO authenticated;
GRANT ALL ON public.offer_presets TO authenticated;
