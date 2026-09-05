-- Add missing columns and fix constraints for kanban_cards table
-- Created: 2026-05-11

-- 1. Make employee_id optional for cards created in shared boards
ALTER TABLE public.kanban_cards ALTER COLUMN employee_id DROP NOT NULL;

-- 2. Add missing date and metadata columns
ALTER TABLE public.kanban_cards 
ADD COLUMN IF NOT EXISTS start_date TEXT,
ADD COLUMN IF NOT EXISTS due_date TEXT,
ADD COLUMN IF NOT EXISTS due_time TEXT,
ADD COLUMN IF NOT EXISTS recurrence TEXT,
ADD COLUMN IF NOT EXISTS reminder TEXT,
ADD COLUMN IF NOT EXISTS due_date_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_status TEXT,
ADD COLUMN IF NOT EXISTS ai_report JSONB,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS original_message TEXT,
ADD COLUMN IF NOT EXISTS position_index INTEGER DEFAULT 0;

