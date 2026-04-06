-- =====================================================
-- Migration: Product Categories Table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,          -- ex: "CARNES", "FRIOS"
  keywords TEXT[] DEFAULT '{}'::text[], -- ex: {"carne", "frango"}
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read product_categories" ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "Anyone can insert product_categories" ON public.product_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update product_categories" ON public.product_categories FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete product_categories" ON public.product_categories FOR DELETE USING (true);

-- Seed initial categories from current hardcoded list
INSERT INTO public.product_categories (name, keywords, display_order) VALUES 
  ('CARNES', ARRAY['carne', 'frango', 'peixe', 'linguiça', 'salsicha', 'bacon', 'costela', 'picanha', 'alcatra', 'filé', 'bife', 'acém', 'pernil', 'coxa', 'peito de frango', 'sobrecoxa', 'asa', 'moída', 'cupim', 'maminha'], 1),
  ('FRIOS E LATICÍNIOS', ARRAY['queijo', 'presunto', 'leite', 'iogurte', 'manteiga', 'requeijão', 'creme de leite', 'mussarela', 'mortadela', 'margarina', 'nata', 'ricota'], 2),
  ('MERCEARIA', ARRAY['arroz', 'feijão', 'macarrão', 'farinha', 'açúcar', 'sal', 'café', 'óleo', 'azeite', 'vinagre', 'molho', 'extrato', 'massa', 'aveia', 'fubá', 'amido', 'trigo'], 3),
  ('BEBIDAS', ARRAY['refrigerante', 'suco', 'água', 'cerveja', 'vinho', 'energético', 'chá', 'coca', 'guaraná', 'fanta'], 4),
  ('LIMPEZA', ARRAY['detergente', 'sabão', 'desinfetante', 'água sanitária', 'amaciante', 'esponja', 'saco de lixo', 'limpador', 'alvejante', 'cloro'], 5),
  ('HIGIENE', ARRAY['shampoo', 'sabonete', 'pasta de dente', 'escova', 'papel higiênico', 'absorvente', 'desodorante', 'creme dental', 'fralda'], 6),
  ('HORTIFRUTI', ARRAY['banana', 'maçã', 'laranja', 'tomate', 'cebola', 'alho', 'batata', 'cenoura', 'limão', 'alface', 'manga', 'uva', 'melancia', 'abacaxi'], 7),
  ('PADARIA', ARRAY['pão', 'bolo', 'biscoito', 'bolacha', 'torrada', 'rosca'], 8),
  ('CONGELADOS', ARRAY['pizza', 'lasanha', 'hambúrguer', 'nugget', 'sorvete', 'açaí', 'polpa'], 9)
ON CONFLICT (name) DO NOTHING;

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_categories;
