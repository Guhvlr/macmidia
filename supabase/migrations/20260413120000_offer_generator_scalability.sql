-- 1. Create tables for concurrent scalable Offer Engine
CREATE TABLE IF NOT EXISTS public.offer_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    client TEXT,
    slots JSONB DEFAULT '[]'::jsonb,
    slot_settings JSONB DEFAULT '{}'::jsonb,
    price_badge JSONB DEFAULT '{}'::jsonb,
    desc_config JSONB DEFAULT '{}'::jsonb,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.offer_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    client TEXT,
    price_badge JSONB DEFAULT '{}'::jsonb,
    desc_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.offer_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_presets ENABLE ROW LEVEL SECURITY;

-- Allow read/write for all users
CREATE POLICY "Allow all on offer_templates" ON public.offer_templates FOR ALL USING (true);
CREATE POLICY "Allow all on offer_presets" ON public.offer_presets FOR ALL USING (true);

-- 2. Migrate existing data from `settings` table
-- 2.1 Migrate Presets
DO $$
DECLARE
    presets_json JSONB;
    preset JSONB;
BEGIN
    SELECT value::jsonb INTO presets_json FROM public.settings WHERE key = 'offer_generator_presets';
    IF presets_json IS NOT NULL AND jsonb_typeof(presets_json) = 'array' THEN
        FOR preset IN SELECT * FROM jsonb_array_elements(presets_json)
        LOOP
            INSERT INTO public.offer_presets (id, name, client, price_badge, desc_config)
            VALUES (
                COALESCE((preset->>'id')::uuid, gen_random_uuid()),
                COALESCE(preset->>'name', 'Untitled Preset'),
                preset->>'client',
                COALESCE(preset->'priceBadge', '{}'::jsonb),
                COALESCE(preset->'descConfig', '{}'::jsonb)
            ) ON CONFLICT (id) DO NOTHING;
        END LOOP;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Skipping preset migration due to error: %', SQLERRM;
END $$;

-- 2.2 Migrate Templates
DO $$
DECLARE
    templates_json JSONB;
    t JSONB;
BEGIN
    SELECT value::jsonb INTO templates_json FROM public.settings WHERE key = 'offer_generator_page_templates';
    IF templates_json IS NOT NULL AND jsonb_typeof(templates_json) = 'array' THEN
        FOR t IN SELECT * FROM jsonb_array_elements(templates_json)
        LOOP
            INSERT INTO public.offer_templates (id, name, client, slots, slot_settings, price_badge, desc_config, config)
            VALUES (
                COALESCE((t->>'id')::uuid, gen_random_uuid()),
                COALESCE(t->>'name', 'Untitled Template'),
                t->>'client',
                COALESCE(t->'slots', '[]'::jsonb),
                COALESCE(t->'slotSettings', '{}'::jsonb),
                COALESCE(t->'priceBadge', '{}'::jsonb),
                COALESCE(t->'descConfig', '{}'::jsonb),
                COALESCE(t->'config', '{}'::jsonb)
            ) ON CONFLICT (id) DO NOTHING;
        END LOOP;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Skipping template migration due to error: %', SQLERRM;
END $$;
