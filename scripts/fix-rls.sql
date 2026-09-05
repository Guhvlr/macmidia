CREATE POLICY "Allow anon to insert products" ON public.products FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon to update products" ON public.products FOR UPDATE TO anon USING (true) WITH CHECK (true);
