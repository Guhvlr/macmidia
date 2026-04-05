-- Support multiple media attachments in calendar tasks
ALTER TABLE public.calendar_tasks ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';
