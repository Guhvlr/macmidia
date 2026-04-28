CREATE POLICY "Allow authenticated to insert offer_presets" ON public.offer_presets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated to update offer_presets" ON public.offer_presets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated to delete offer_presets" ON public.offer_presets FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated to insert offer_templates" ON public.offer_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated to update offer_templates" ON public.offer_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated to delete offer_templates" ON public.offer_templates FOR DELETE TO authenticated USING (true);
