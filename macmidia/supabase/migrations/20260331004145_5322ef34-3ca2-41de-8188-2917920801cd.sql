
DROP TRIGGER IF EXISTS auto_archive_kanban_cards ON public.kanban_cards;
DROP TRIGGER IF EXISTS auto_archive_kanban_cards_insert ON public.kanban_cards;
DROP TRIGGER IF EXISTS trigger_auto_archive ON public.kanban_cards;
DROP TRIGGER IF EXISTS trigger_auto_archive_insert ON public.kanban_cards;

DROP FUNCTION IF EXISTS public.auto_set_archived_at() CASCADE;
DROP FUNCTION IF EXISTS public.auto_set_archived_at_insert() CASCADE;

CREATE OR REPLACE FUNCTION public.auto_set_archived_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW."column" = 'postado' AND (OLD."column" IS DISTINCT FROM 'postado') THEN
    NEW.archived_at = now();
  ELSIF NEW."column" != 'postado' AND OLD."column" = 'postado' THEN
    NEW.archived_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_set_archived_at_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW."column" = 'postado' THEN
    NEW.archived_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_archive
  BEFORE UPDATE ON public.kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_archived_at();

CREATE TRIGGER trigger_auto_archive_insert
  BEFORE INSERT ON public.kanban_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_archived_at_insert();
