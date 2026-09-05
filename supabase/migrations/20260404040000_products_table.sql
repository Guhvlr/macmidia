-- Enable pg_trgm for fuzzy searching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ean TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  image_url TEXT, -- External URL fallback
  image_path TEXT, -- Internal Supabase path (ean.png)
  brand TEXT,
  price NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admin can manage products" ON public.products FOR ALL USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS products_ean_idx ON public.products(ean);
CREATE INDEX IF NOT EXISTS products_name_trgm_idx ON public.products USING GIN (name gin_trgm_ops);

-- Update trigger
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create a bucket for product images if possible via SQL (depends on permissions)
-- Usually managed via Supabase Dashboard, but we can try to insert into storage schema
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the bucket
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Admin All Access" ON storage.objects FOR ALL USING (bucket_id = 'product-images');

-- Fuzzy Search function (RPC)
CREATE OR REPLACE FUNCTION public.search_products_fuzzy(search_text TEXT, match_threshold FLOAT DEFAULT 0.1)
RETURNS SETOF public.products
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.products
  WHERE 
    similarity(name, search_text) > match_threshold
    OR ean = search_text
  ORDER BY similarity(name, search_text) DESC
  LIMIT 5;
END;
$$;
