-- SECURITY HARDENING: Row Level Security (RLS) enforcement
-- Created: 2026-04-05
-- This migration tightens access control for sensitive tables.

-- 1. Helper function to check if the current user is an Admin
-- Uses system_users table which is properly linked to auth.users(id)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER -- Runs with elevated privileges to check system_users
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.system_users 
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
END;
$$;

-- 2. Hardening for 'credentials' (The Vault)
-- Only Admins should even know these credentials exist.
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read credentials" ON public.credentials;
DROP POLICY IF EXISTS "Anyone can insert credentials" ON public.credentials;
DROP POLICY IF EXISTS "Anyone can update credentials" ON public.credentials;
DROP POLICY IF EXISTS "Anyone can delete credentials" ON public.credentials;

CREATE POLICY "Admins can manage credentials" 
  ON public.credentials FOR ALL 
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. Hardening for 'employees'
-- Authenticated users can read (for assignments), but only Admins can modify.
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read employees" ON public.employees;
DROP POLICY IF EXISTS "Anyone can insert employees" ON public.employees;
DROP POLICY IF EXISTS "Anyone can update employees" ON public.employees;
DROP POLICY IF EXISTS "Anyone can delete employees" ON public.employees;

CREATE POLICY "Authenticated users can read employees" 
  ON public.employees FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage employees" 
  ON public.employees FOR ALL 
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. Hardening for 'kanban_cards'
-- Authenticated users can work with cards, but only Admins can delete.
ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read kanban_cards" ON public.kanban_cards;
DROP POLICY IF EXISTS "Anyone can insert kanban_cards" ON public.kanban_cards;
DROP POLICY IF EXISTS "Anyone can update kanban_cards" ON public.kanban_cards;
DROP POLICY IF EXISTS "Anyone can delete kanban_cards" ON public.kanban_cards;

CREATE POLICY "Authenticated users can read and create cards" 
  ON public.kanban_cards FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert cards" 
  ON public.kanban_cards FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update cards" 
  ON public.kanban_cards FOR UPDATE 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins can delete cards" 
  ON public.kanban_cards FOR DELETE 
  USING (public.is_admin());

-- 5. Hardening for 'calendar_clients' and 'calendar_tasks'
ALTER TABLE public.calendar_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read calendar_clients" ON public.calendar_clients;
DROP POLICY IF EXISTS "Anyone can insert calendar_clients" ON public.calendar_clients;
DROP POLICY IF EXISTS "Anyone can delete calendar_clients" ON public.calendar_clients;

CREATE POLICY "Authenticated users can manage calendar_clients" 
  ON public.calendar_clients FOR ALL 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE public.calendar_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read calendar_tasks" ON public.calendar_tasks;
DROP POLICY IF EXISTS "Anyone can insert calendar_tasks" ON public.calendar_tasks;
DROP POLICY IF EXISTS "Anyone can update calendar_tasks" ON public.calendar_tasks;
DROP POLICY IF EXISTS "Anyone can delete calendar_tasks" ON public.calendar_tasks;

CREATE POLICY "Authenticated users can manage calendar_tasks" 
  ON public.calendar_tasks FOR ALL 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 6. Hardening for 'whatsapp_messages' and 'whatsapp_inbox'
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read messages" ON public.whatsapp_messages;
CREATE POLICY "Admins can manage whatsapp_messages" 
  ON public.whatsapp_messages FOR ALL 
  USING (public.is_admin());

DROP POLICY IF EXISTS "Anyone can read inbox" ON public.whatsapp_inbox;
CREATE POLICY "Authenticated users can read inbox" 
  ON public.whatsapp_inbox FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage inbox" 
  ON public.whatsapp_inbox FOR ALL 
  USING (public.is_admin());

-- 7. Fix system_logs policies to use is_admin()
DROP POLICY IF EXISTS "Allow admins to select logs" ON public.system_logs;
CREATE POLICY "Allow admins to select logs"
  ON public.system_logs FOR SELECT 
  USING (public.is_admin());
