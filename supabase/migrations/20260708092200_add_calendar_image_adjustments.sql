ALTER TABLE public.calendar_tasks 
ADD COLUMN IF NOT EXISTS selected_networks TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS image_adjustments JSONB DEFAULT '{}'::jsonb;
