-- Make employee_id column optional in calendar_tasks to support simplified creation workflow
ALTER TABLE public.calendar_tasks ALTER COLUMN employee_id DROP NOT NULL;
