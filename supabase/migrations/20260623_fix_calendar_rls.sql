-- Fix: Recriar políticas de segurança (RLS) para calendar_tasks
-- Problema: Visitantes (GUEST) autenticados não conseguiam criar cards no calendário
-- Solução: Políticas abertas para SELECT/INSERT/UPDATE/DELETE para qualquer usuário autenticado
-- Data: 2026-06-23

-- Remover a política restritiva atual
DROP POLICY IF EXISTS "Authenticated users can manage calendar_tasks" ON public.calendar_tasks;
DROP POLICY IF EXISTS "calendar_tasks_select" ON public.calendar_tasks;
DROP POLICY IF EXISTS "calendar_tasks_insert" ON public.calendar_tasks;
DROP POLICY IF EXISTS "calendar_tasks_update" ON public.calendar_tasks;
DROP POLICY IF EXISTS "calendar_tasks_delete" ON public.calendar_tasks;

-- Garantir que RLS está habilitado
ALTER TABLE public.calendar_tasks ENABLE ROW LEVEL SECURITY;

-- Recriar políticas individuais mais permissivas
CREATE POLICY "calendar_tasks_select" ON public.calendar_tasks FOR SELECT USING (true);
CREATE POLICY "calendar_tasks_insert" ON public.calendar_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "calendar_tasks_update" ON public.calendar_tasks FOR UPDATE USING (true);
CREATE POLICY "calendar_tasks_delete" ON public.calendar_tasks FOR DELETE USING (true);
