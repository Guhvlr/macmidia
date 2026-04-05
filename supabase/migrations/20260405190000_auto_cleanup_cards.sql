-- AUTO-CLEANUP: Automatically delete old archived cards
-- Created: 2026-04-05
-- This migration schedules a daily job to permanently delete cards archived more than 60 days ago.

-- 1. Create a function to perform the cleanup
CREATE OR REPLACE FUNCTION public.delete_old_kanban_cards()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
  -- Delete cards archived more than 60 days ago
  DELETE FROM public.kanban_cards 
  WHERE archived_at IS NOT NULL 
    AND archived_at < (now() - interval '60 days');
END;
$$;

-- 2. Schedule the job using pg_cron (if available)
-- Note: pg_cron is available on Supabase in the 'extensions' schema.
-- Ensure the extension is enabled (usually needs to be done via the Supabase Dashboard, 
-- but this script attempts to enable it if the user has permissions).

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the cleanup to run every day at 03:00 AM UTC
SELECT cron.schedule(
  'cleanup-old-kanban-cards',
  '0 3 * * *', -- Everyday at 3 AM
  'SELECT public.delete_old_kanban_cards()'
);

-- 3. Update the UI message to be 100% accurate (Optional)
-- The UI already says "Exclusão automática em 60 dias", which matches this script.
