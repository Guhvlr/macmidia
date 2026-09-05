-- =====================================================
-- Migration: Optimize Realtime Sync (Replica Identity)
-- =====================================================

-- For Supabase Realtime to send the full row on UPDATE events,
-- we should set REPLICA IDENTITY to FULL for these tables.
-- Otherwise, the payload might only contain the primary key and changed columns.

ALTER TABLE public.kanban_cards REPLICA IDENTITY FULL;
ALTER TABLE public.employees REPLICA IDENTITY FULL;
ALTER TABLE public.kanban_columns REPLICA IDENTITY FULL;
ALTER TABLE public.calendar_tasks REPLICA IDENTITY FULL;
ALTER TABLE public.credentials REPLICA IDENTITY FULL;
ALTER TABLE public.calendar_clients REPLICA IDENTITY FULL;

-- Ensure they are in the realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'kanban_cards'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_cards;
  END IF;
END $$;

-- Repeat for other tables if necessary, but the previous migration already did most.
