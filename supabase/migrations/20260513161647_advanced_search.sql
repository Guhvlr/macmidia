-- Enable unaccent extension for ignoring accents in text search
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create an advanced fuzzy search function that ignores accents
CREATE OR REPLACE FUNCTION public.search_variations(search_term TEXT)
RETURNS SETOF public.products
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.products
  WHERE 
    unaccent(lower(name)) ILIKE '%' || unaccent(lower(search_term)) || '%'
    OR unaccent(lower(COALESCE(brand, ''))) ILIKE '%' || unaccent(lower(search_term)) || '%'
  ORDER BY 
    brand NULLS LAST,
    name ASC
  LIMIT 50;
END;
$$;
