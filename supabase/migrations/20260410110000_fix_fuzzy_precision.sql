
-- Enable pg_trgm for fuzzy searching if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Update the fuzzy search function to be case-insensitive and more robust
CREATE OR REPLACE FUNCTION public.search_products_fuzzy(search_text TEXT, match_threshold FLOAT DEFAULT 0.3)
RETURNS SETOF public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.products
  WHERE 
    similarity(lower(name), lower(search_text)) >= match_threshold
    OR ean = search_text
  ORDER BY similarity(lower(name), lower(search_text)) DESC
  LIMIT 5;
END;
$$;

-- Ensure GIN index exists for performance
CREATE INDEX IF NOT EXISTS products_name_trgm_idx ON public.products USING GIN (name gin_trgm_ops);
