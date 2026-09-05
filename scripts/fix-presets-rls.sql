-- Habilitar RLS mas permitir tudo para usuários autenticados nas tabelas de presets e templates
-- Isso garante que as operações de delete e update funcionem corretamente.

-- Tabela de Presets (Modelos)
ALTER TABLE public.offer_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated on offer_presets" ON public.offer_presets;
CREATE POLICY "Allow all for authenticated on offer_presets" ON public.offer_presets 
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Tabela de Templates
ALTER TABLE public.offer_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated on offer_templates" ON public.offer_templates;
CREATE POLICY "Allow all for authenticated on offer_templates" ON public.offer_templates 
    FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Garantir que as tabelas tenham a coluna updated_at se não tiverem
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='offer_presets' AND COLUMN_NAME='updated_at') THEN
        ALTER TABLE public.offer_presets ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;
