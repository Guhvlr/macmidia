-- AJUSTE DE CAPACIDADE DE DADOS PARA PROJETOS E TEMPLATES
-- Isso garante que as colunas JSON não tenham restrições de tamanho que causem o erro "object exceeded maximum size"

-- 1. Tabela de Projetos
ALTER TABLE public.offer_projects ALTER COLUMN state SET DATA TYPE jsonb USING state::jsonb;

-- 2. Tabela de Templates
ALTER TABLE public.offer_templates ALTER COLUMN slots SET DATA TYPE jsonb USING slots::jsonb;
ALTER TABLE public.offer_templates ALTER COLUMN slot_settings SET DATA TYPE jsonb USING slot_settings::jsonb;

-- 3. Tabela de Presets
ALTER TABLE public.offer_presets ALTER COLUMN price_badge SET DATA TYPE jsonb USING price_badge::jsonb;
ALTER TABLE public.offer_presets ALTER COLUMN desc_config SET DATA TYPE jsonb USING desc_config::jsonb;

-- Nota: JSONB é mais eficiente e geralmente não possui os mesmos limites restritivos que o tipo TEXT ou JSON simples em algumas configurações.
