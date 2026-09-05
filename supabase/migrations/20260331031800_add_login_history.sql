ALTER TABLE employees 
ADD COLUMN email TEXT,
ADD COLUMN password TEXT;

ALTER TABLE kanban_cards
ADD COLUMN history JSONB DEFAULT '[]'::jsonb;
