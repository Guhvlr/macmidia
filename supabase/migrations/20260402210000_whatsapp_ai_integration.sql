-- =====================================================
-- Migration: WhatsApp + IA Integration Tables
-- =====================================================

-- 1. WhatsApp Messages Log (registra mensagens recebidas)
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  remote_jid TEXT NOT NULL,              -- ID do grupo/contato
  sender TEXT,                           -- Quem enviou 
  message_text TEXT NOT NULL,            -- Texto da mensagem
  message_type TEXT NOT NULL DEFAULT 'text', -- text, image, etc.
  raw_payload JSONB DEFAULT '{}'::jsonb, -- Payload completo da Evolution API
  parsed_data JSONB,                     -- Dados interpretados pela IA
  status TEXT NOT NULL DEFAULT 'received', -- received, processing, parsed, error, ignored
  kanban_card_id UUID REFERENCES public.kanban_cards(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read whatsapp_messages" ON public.whatsapp_messages FOR SELECT USING (true);
CREATE POLICY "Anyone can insert whatsapp_messages" ON public.whatsapp_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update whatsapp_messages" ON public.whatsapp_messages FOR UPDATE USING (true);

-- 2. AI Corrections (relatórios de correção da IA)
CREATE TABLE IF NOT EXISTS public.ai_corrections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kanban_card_id UUID NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, analyzing, completed, error
  analysis_result JSONB,                 -- Resultado completo da análise
  issues_found JSONB DEFAULT '[]'::jsonb, -- Lista de problemas encontrados
  corrections_applied JSONB DEFAULT '[]'::jsonb, -- Correções aplicadas
  ai_model TEXT DEFAULT 'gpt-4o',
  processing_steps JSONB DEFAULT '[]'::jsonb, -- Steps para feedback visual
  moved_to_alteration BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.ai_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read ai_corrections" ON public.ai_corrections FOR SELECT USING (true);
CREATE POLICY "Anyone can insert ai_corrections" ON public.ai_corrections FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update ai_corrections" ON public.ai_corrections FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete ai_corrections" ON public.ai_corrections FOR DELETE USING (true);

-- 3. Adicionar colunas de IA ao kanban_cards
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kanban_cards' AND column_name='ai_status') THEN
    ALTER TABLE public.kanban_cards ADD COLUMN ai_status TEXT DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kanban_cards' AND column_name='ai_report') THEN
    ALTER TABLE public.kanban_cards ADD COLUMN ai_report JSONB DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kanban_cards' AND column_name='source') THEN
    ALTER TABLE public.kanban_cards ADD COLUMN source TEXT DEFAULT 'manual';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='kanban_cards' AND column_name='original_message') THEN
    ALTER TABLE public.kanban_cards ADD COLUMN original_message TEXT DEFAULT NULL;
  END IF;
END $$;

-- 4. Client-Employee mapping (para saber de qual funcionário é cada cliente)
CREATE TABLE IF NOT EXISTS public.client_employee_map (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name_pattern TEXT NOT NULL,     -- ex: "COUTO", "COUTO OFERTA"
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  employee_name TEXT,                    -- Cache do nome para facilitar lookup
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_employee_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read client_employee_map" ON public.client_employee_map FOR SELECT USING (true);
CREATE POLICY "Anyone can insert client_employee_map" ON public.client_employee_map FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update client_employee_map" ON public.client_employee_map FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete client_employee_map" ON public.client_employee_map FOR DELETE USING (true);

-- 5. WhatsApp config (configurações de integração)
INSERT INTO public.settings (key, value) VALUES 
  ('whatsapp_enabled', 'false'),
  ('whatsapp_webhook_secret', ''),
  ('openai_model_parse', 'gpt-4o-mini'),
  ('openai_model_correction', 'gpt-4o'),
  ('auto_organize_products', 'true')
ON CONFLICT (key) DO NOTHING;

-- 6. Enable Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_corrections;
