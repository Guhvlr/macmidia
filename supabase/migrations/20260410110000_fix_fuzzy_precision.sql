
-- Enable pg_trgm for fuzzy searching if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Update the fuzzy search function to be stricter (default threshold 0.3 instead of 0.1)
-- This avoids brands like "Italac" matching "Itambé" too easily.
CREATE OR REPLACE FUNCTION public.search_products_fuzzy(search_text TEXT, match_threshold FLOAT DEFAULT 0.3)
RETURNS SETOF public.products
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.products
  WHERE 
    similarity(name, search_text) >= match_threshold
    OR ean = search_text
  ORDER BY similarity(name, search_text) DESC
  LIMIT 5;
END;
$$;

-- Ensure GIN index exists for performance
CREATE INDEX IF NOT EXISTS products_name_trgm_idx ON public.products USING GIN (name gin_trgm_ops);
