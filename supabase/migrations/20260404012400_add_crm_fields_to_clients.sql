-- Add CRM-like fields to calendar_clients
ALTER TABLE calendar_clients ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE calendar_clients ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE calendar_clients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE calendar_clients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE calendar_clients ADD COLUMN IF NOT EXISTS notes TEXT;

-- Link credentials to calendar_clients
ALTER TABLE credentials ADD COLUMN IF NOT EXISTS calendar_client_id TEXT REFERENCES calendar_clients(id);
