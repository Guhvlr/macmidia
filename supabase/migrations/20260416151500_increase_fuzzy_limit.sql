
-- Update the fuzzy search function to allow custom limits and be more flexible
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
  LIMIT 25; -- Aumentado de 5 para 25 para permitir análise de marca no backend
END;
$$;
