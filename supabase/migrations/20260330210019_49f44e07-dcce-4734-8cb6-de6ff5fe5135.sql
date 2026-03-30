
CREATE TABLE public.kanban_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  column_key text NOT NULL,
  title text NOT NULL,
  color text NOT NULL DEFAULT 'bg-primary',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read kanban_columns" ON public.kanban_columns FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert kanban_columns" ON public.kanban_columns FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update kanban_columns" ON public.kanban_columns FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete kanban_columns" ON public.kanban_columns FOR DELETE TO public USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_columns;
