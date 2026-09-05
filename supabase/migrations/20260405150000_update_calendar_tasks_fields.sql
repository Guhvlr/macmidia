-- Update calendar_tasks table with new fields for references and content
ALTER TABLE public.calendar_tasks ADD COLUMN IF NOT EXISTS reference_links TEXT[] DEFAULT '{}';
ALTER TABLE public.calendar_tasks ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '';
