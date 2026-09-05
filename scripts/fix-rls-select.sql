CREATE POLICY "Allow anon to read products" ON public.products FOR SELECT TO anon USING (true);
