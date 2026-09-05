-- Remove the UNIQUE constraint on ean to allow client-specific variations
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_ean_key;

-- Add client_name column
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS client_name TEXT;

-- Update the fuzzy search function to include the new column (implicit since it returns *)
-- No changes needed to search_products_fuzzy as it returns SETOF products

-- Add an index for faster lookups by EAN and Client
CREATE INDEX IF NOT EXISTS products_ean_client_idx ON public.products(ean, client_name);
