-- Migrate existing cards from old 'aprovado'/'programar' columns to merged 'aprovado-programar'
UPDATE public.kanban_cards SET "column" = 'aprovado-programar' WHERE "column" IN ('aprovado', 'programar');

-- Migrate existing column definitions
UPDATE public.kanban_columns SET column_key = 'aprovado-programar', title = 'Aprovado e Programar', color = 'bg-success' WHERE column_key IN ('aprovado', 'programar');

-- Remove duplicate rows after merge (keep the one with lowest position)
DELETE FROM public.kanban_columns a
USING public.kanban_columns b
WHERE a.column_key = 'aprovado-programar'
  AND b.column_key = 'aprovado-programar'
  AND a.employee_id = b.employee_id
  AND a.position > b.position;

-- Fix positions for postado column
UPDATE public.kanban_columns SET position = 6 WHERE column_key = 'postado';