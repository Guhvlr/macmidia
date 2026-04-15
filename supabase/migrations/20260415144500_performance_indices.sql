-- Otimização de busca no Kanban (Modo Resiliente - CONCURRENTLY)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kanban_cards_employee_id ON public.kanban_cards(employee_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kanban_cards_archived_at ON public.kanban_cards(archived_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kanban_cards_column ON public.kanban_cards("column");

-- Otimização de busca no Calendário
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_tasks_employee_id ON public.calendar_tasks(employee_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_tasks_client_id ON public.calendar_tasks(calendar_client_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_tasks_date ON public.calendar_tasks(date);

-- Otimização Crítica: WhatsApp
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_messages_created_at ON public.whatsapp_messages(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_messages_status ON public.whatsapp_messages(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_messages_remote_jid ON public.whatsapp_messages(remote_jid);

-- MANUTENÇÃO AUTOMÁTICA: Limpeza de WhatsApp a cada 3 dias
-- 1. Função de limpeza
CREATE OR REPLACE FUNCTION public.cleanup_whatsapp_messages()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.whatsapp_messages WHERE created_at < now() - interval '3 days';
END;
$$;

-- 2. Agendamento (roda diariamente às 03:00 e remove o que tem + de 3 dias)
SELECT cron.schedule(
  'cleanup-whatsapp-messages',
  '0 3 * * *',
  'SELECT public.cleanup_whatsapp_messages()'
);
