-- Cria a tabela de layouts do Offer Studio
CREATE TABLE public.offer_layouts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  image_url text NOT NULL,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Configura segurança RLS
ALTER TABLE public.offer_layouts ENABLE ROW LEVEL SECURITY;

-- Permite tudo temporário para o dashboard ou autenticados
CREATE POLICY "Enable all for authenticated users only" ON public.offer_layouts
  FOR ALL USING (auth.role() = 'authenticated');
