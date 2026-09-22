-- ===========================================================================
-- Correção: Alterar tipo da coluna kanban_link para suportar múltiplos quadros (CSV)
-- O banco de dados estava rejeitando textos com vírgula porque a coluna
-- estava definida como tipo UUID. Precisamos alterá-la para TEXT.
-- ===========================================================================

DO $$ 
DECLARE 
    fk_name text;
BEGIN
    SELECT constraint_name INTO fk_name
    FROM information_schema.key_column_usage
    WHERE table_name = 'system_users' AND column_name = 'kanban_link'
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.system_users DROP CONSTRAINT ' || fk_name;
    END IF;
END $$;

ALTER TABLE public.system_users ALTER COLUMN kanban_link TYPE TEXT;