-- Create timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Employees table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Membro',
  avatar TEXT NOT NULL DEFAULT '👤',
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read employees" ON public.employees FOR SELECT USING (true);
CREATE POLICY "Anyone can insert employees" ON public.employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update employees" ON public.employees FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete employees" ON public.employees FOR DELETE USING (true);

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Kanban cards table
CREATE TABLE public.kanban_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  notes TEXT,
  images TEXT[] DEFAULT '{}',
  "column" TEXT NOT NULL DEFAULT 'todo' CHECK ("column" IN ('todo', 'production', 'correction', 'done')),
  time_spent INTEGER NOT NULL DEFAULT 0,
  timer_running BOOLEAN NOT NULL DEFAULT false,
  timer_start BIGINT,
  archived_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read kanban_cards" ON public.kanban_cards FOR SELECT USING (true);
CREATE POLICY "Anyone can insert kanban_cards" ON public.kanban_cards FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update kanban_cards" ON public.kanban_cards FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete kanban_cards" ON public.kanban_cards FOR DELETE USING (true);

CREATE TRIGGER update_kanban_cards_updated_at BEFORE UPDATE ON public.kanban_cards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Calendar clients table
CREATE TABLE public.calendar_clients (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read calendar_clients" ON public.calendar_clients FOR SELECT USING (true);
CREATE POLICY "Anyone can insert calendar_clients" ON public.calendar_clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete calendar_clients" ON public.calendar_clients FOR DELETE USING (true);

-- Calendar tasks table
CREATE TABLE public.calendar_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calendar_client_id TEXT NOT NULL REFERENCES public.calendar_clients(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  client_name TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  time TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read calendar_tasks" ON public.calendar_tasks FOR SELECT USING (true);
CREATE POLICY "Anyone can insert calendar_tasks" ON public.calendar_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update calendar_tasks" ON public.calendar_tasks FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete calendar_tasks" ON public.calendar_tasks FOR DELETE USING (true);

CREATE TRIGGER update_calendar_tasks_updated_at BEFORE UPDATE ON public.calendar_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Credentials table
CREATE TABLE public.credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read credentials" ON public.credentials FOR SELECT USING (true);
CREATE POLICY "Anyone can insert credentials" ON public.credentials FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update credentials" ON public.credentials FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete credentials" ON public.credentials FOR DELETE USING (true);

CREATE TRIGGER update_credentials_updated_at BEFORE UPDATE ON public.credentials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Settings table for dashboard config
CREATE TABLE public.settings (
  key TEXT NOT NULL PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Anyone can upsert settings" ON public.settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update settings" ON public.settings FOR UPDATE USING (true);

-- Auto-archive trigger: set archived_at when card moves to done
CREATE OR REPLACE FUNCTION public.auto_set_archived_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."column" = 'done' AND (OLD."column" IS DISTINCT FROM 'done') THEN
    NEW.archived_at = now();
  ELSIF NEW."column" != 'done' AND OLD."column" = 'done' THEN
    NEW.archived_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER auto_archive_kanban_cards BEFORE UPDATE ON public.kanban_cards
FOR EACH ROW EXECUTE FUNCTION public.auto_set_archived_at();

CREATE OR REPLACE FUNCTION public.auto_set_archived_at_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."column" = 'done' THEN
    NEW.archived_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER auto_archive_kanban_cards_insert BEFORE INSERT ON public.kanban_cards
FOR EACH ROW EXECUTE FUNCTION public.auto_set_archived_at_insert();