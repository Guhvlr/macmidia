-- FIX: Standardize storage bucket naming and add missing columns to kanban_cards
-- Created: 2026-05-02

-- 1. Fix Storage Policies for 'kanban_assets' (Standardize on underscore)
-- The previous migration '20260427180000_fix_member_permissions.sql' incorrectly used 'kanban-assets' (hyphen)

-- Remove any hyphenated policies that might have been created
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated user upload kanban assets" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated user update kanban assets" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated user delete kanban assets" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated user select kanban assets" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Re-create policies for 'kanban_assets' (underscore)
CREATE POLICY "Authenticated user upload kanban assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'kanban_assets');

CREATE POLICY "Authenticated user update kanban assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'kanban_assets');

CREATE POLICY "Authenticated user delete kanban assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'kanban_assets');

CREATE POLICY "Authenticated user select kanban assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'kanban_assets');

-- 2. Add missing columns to 'kanban_cards'
-- These are used in the code but were missing from early migrations
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS calendar_client_id TEXT;
ALTER TABLE public.kanban_cards ADD COLUMN IF NOT EXISTS calendar_client_name TEXT;

-- 3. Ensure 'images' column is TEXT[] and has a default
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kanban_cards' AND column_name='images') THEN
    ALTER TABLE public.kanban_cards ADD COLUMN images TEXT[] DEFAULT '{}';
  END IF;
END $$;
