
-- =====================================================
-- Migration: Enable Realtime for Kanban and Core Tables
-- =====================================================

-- This migration enables Supabase Realtime for the tables required
-- to provide a collaborative, real-time experience in the Kanban board.

-- Enable Realtime for Kanban related tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_columns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.credentials;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_clients;

-- Enable Realtime for other core tables that benefit from sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_employee_map;

-- Note: system_users, product_categories, whatsapp_messages, and ai_corrections
-- are already enabled in previous migrations.
