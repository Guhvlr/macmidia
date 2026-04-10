-- Migration to ensure offer_layouts table and its columns are correct
-- Created to fix: Could not find the 'client' column of 'offer_layouts' in the schema cache

-- 1. Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.offer_layouts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  image_url text NOT NULL,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add 'client' column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'offer_layouts' 
    AND column_name = 'client'
  ) THEN
    ALTER TABLE public.offer_layouts ADD COLUMN client text;
  END IF;
END $$;

-- 3. Configure RLS if not already enabled
ALTER TABLE public.offer_layouts ENABLE ROW LEVEL SECURITY;

-- 4. Create policy if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'offer_layouts' 
    AND policyname = 'Enable all for authenticated users only'
  ) THEN
    CREATE POLICY "Enable all for authenticated users only" ON public.offer_layouts
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 5. Grant permissions to anon and authenticated roles
GRANT ALL ON public.offer_layouts TO authenticated;
GRANT ALL ON public.offer_layouts TO service_role;
GRANT SELECT ON public.offer_layouts TO anon;
