-- Migration to add Trello-like features to Kanban Cards

ALTER TABLE public.kanban_cards 
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS cover_image text,
ADD COLUMN IF NOT EXISTS labels jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS checklists jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS comments jsonb DEFAULT '[]'::jsonb;
