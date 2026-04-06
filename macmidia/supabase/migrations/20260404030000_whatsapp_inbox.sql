CREATE TABLE IF NOT EXISTS whatsapp_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remote_jid TEXT,
  sender TEXT,
  sender_name TEXT,
  message_text TEXT,
  message_type TEXT DEFAULT 'text',
  media_url TEXT,
  media_mime_type TEXT,
  raw_payload JSONB,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE whatsapp_inbox ENABLE ROW LEVEL SECURITY;
