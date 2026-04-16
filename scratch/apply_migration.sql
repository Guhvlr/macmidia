-- Função auxiliar para remover acentos no PostgreSQL
CREATE OR REPLACE FUNCTION public.unaccent_text(text)
RETURNS text
LANGUAGE sql IMMUTABLE STRICT
AS $$
  SELECT translate($1,
    'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñÝý',
    'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYy'
  );
$$;

-- Atualizar a busca fuzzy para usar nomes sem acento
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
    similarity(lower(public.unaccent_text(name)), lower(public.unaccent_text(search_text))) >= match_threshold
    OR ean = search_text
  ORDER BY similarity(lower(public.unaccent_text(name)), lower(public.unaccent_text(search_text))) DESC
  LIMIT 25;
END;
$$;
