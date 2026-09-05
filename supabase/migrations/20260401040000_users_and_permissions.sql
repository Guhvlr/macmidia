-- Create system_users table for User Management
CREATE TABLE IF NOT EXISTS public.system_users (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read system_users" ON public.system_users FOR SELECT USING (true);
CREATE POLICY "Admins can update system_users" ON public.system_users FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.system_users su WHERE su.id = auth.uid() AND role = 'ADMIN')
);

-- Function to handle new user signups and sync them to system_users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.system_users (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    CASE WHEN (SELECT count(*) FROM public.system_users) = 0 THEN 'ADMIN' ELSE 'USER' END
  );
  RETURN NEW;
END;
$$;

-- Trigger to call handle_new_user on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Backfill any existing users that logged in previously and make them ADMIN automatically to prevent lockout
INSERT INTO public.system_users (id, full_name, email, role)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', email), email, 'ADMIN'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- RPC for admin to delete users explicitly from auth.users (cascades automatically to system_users)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is admin
  IF EXISTS (SELECT 1 FROM public.system_users WHERE id = auth.uid() AND role = 'ADMIN') THEN
    DELETE FROM auth.users WHERE id = target_user_id;
    RETURN true;
  ELSE
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem excluir usuários.';
  END IF;
END;
$$;

-- RPC for admin to update user roles
CREATE OR REPLACE FUNCTION public.admin_update_user_role(target_user_id UUID, new_role TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is admin
  IF EXISTS (SELECT 1 FROM public.system_users WHERE id = auth.uid() AND role = 'ADMIN') THEN
    UPDATE public.system_users SET role = new_role WHERE id = target_user_id;
    RETURN true;
  ELSE
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem editar usuários.';
  END IF;
END;
$$;

-- Add assigned_users column to kanban_cards so we can assign multiple system users
ALTER TABLE public.kanban_cards 
ADD COLUMN IF NOT EXISTS assigned_users jsonb DEFAULT '[]'::jsonb;

-- Expose table to realtime subscription
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_users;
