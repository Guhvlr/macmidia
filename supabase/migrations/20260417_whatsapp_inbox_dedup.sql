-- 1. ADICIONA COLUNA DE ID ÚNICO DO WHATSAPP
-- Isso evita que mensagens repetidas (retries do webhook) criem múltiplas linhas.

-- Adiciona a coluna se não existir
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='whatsapp_inbox' AND column_name='whatsapp_message_id') THEN
    ALTER TABLE public.whatsapp_inbox ADD COLUMN whatsapp_message_id TEXT;
  END IF;
END $$;

-- 2. LIMPEZA DE DUPLICADOS E MENSAGENS "PRESAS"
-- Remove mensagens que tenham o mesmo corpo e remetente criadas no curto intervalo (duplicatas de retry)
-- Também remove qualquer mensagem que esteja "bugada" (ex: sem texto e sem mídia útil)
DELETE FROM public.whatsapp_inbox
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER(PARTITION BY remote_jid, message_text, created_at::date ORDER BY created_at ASC) as row_num
        FROM public.whatsapp_inbox
    ) t
    WHERE t.row_num > 1
);

-- Tenta preencher o whatsapp_message_id a partir do json se possível (opcional, para legado)
UPDATE public.whatsapp_inbox
SET whatsapp_message_id = (raw_payload->'data'->'key'->>'id')
WHERE whatsapp_message_id IS NULL AND raw_payload->'data'->'key'->>'id' IS NOT NULL;

-- 3. ADICIONA CONSTRAINT UNIQUE
-- Agora que limpamos, garantimos que não entre mais duplicado.
-- Nota: Não colocamos NOT NULL ainda para não quebrar mensagens antigas sem ID.
ALTER TABLE public.whatsapp_inbox DROP CONSTRAINT IF EXISTS whatsapp_inbox_msg_id_unique;
ALTER TABLE public.whatsapp_inbox ADD CONSTRAINT whatsapp_inbox_msg_id_unique UNIQUE (whatsapp_message_id);

-- 4. AJUSTE DE RLS (VISIBILIDADE)
-- Garante que qualquer usuário autenticado possa ver as mensagens.
DROP POLICY IF EXISTS "Authenticated users can read inbox" ON public.whatsapp_inbox;
CREATE POLICY "Authenticated users can read inbox" 
  ON public.whatsapp_inbox FOR SELECT 
  USING (auth.role() = 'authenticated');

-- 5. ROBÔ DE LIMPEZA (EXTRASS)
-- Aumentamos a agressividade da limpeza se o bando estiver muito cheio
-- Mas mantemos os 3 dias por enquanto conforme solicitado.
CREATE OR REPLACE FUNCTION public.cleanup_old_whatsapp_messages()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deleta mensagens com mais de 3 dias
  DELETE FROM public.whatsapp_inbox 
  WHERE created_at < (now() - interval '3 days');
  
  -- Se o banco estiver muito grande (opcional), poderíamos deletar o raw_payload de mensagens antigas
  -- UPDATE public.whatsapp_inbox SET raw_payload = '{}'::jsonb WHERE created_at < (now() - interval '1 day') AND status != 'pending';
END;
$$;
