-- 1. Melhoria de Performance nas Funções de Admin
ALTER FUNCTION public.is_admin() STABLE;

-- 2. Índices de Performance (Calendário e WhatsApp)
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbox_status_created ON public.whatsapp_inbox(status, created_at);
CREATE INDEX IF NOT EXISTS idx_calendar_tasks_client_id ON public.calendar_tasks(calendar_client_id);
CREATE INDEX IF NOT EXISTS idx_calendar_tasks_employee_id ON public.calendar_tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_calendar_clients_name ON public.calendar_clients(name);
CREATE INDEX IF NOT EXISTS idx_employees_name ON public.employees(name);

-- 3. Robô de Limpeza Automática (3 dias)
CREATE OR REPLACE FUNCTION public.cleanup_old_whatsapp_messages()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.whatsapp_inbox 
  WHERE created_at < (now() - interval '3 days');
END;
$$;

-- Agenda o robô (se não existir)
-- Nota: Usamos cron.schedule para garantir que a limpeza ocorra diariamente
SELECT cron.schedule(
  'limpeza-diaria-whatsapp-3-dias',
  '0 3 * * *', 
  'SELECT public.cleanup_old_whatsapp_messages()'
);

-- 4. Segurança de Notificações
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);
