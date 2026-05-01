-- Add unit column to products table to persist 'cada' vs 'KG' preference
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'cada';
