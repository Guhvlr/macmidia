-- RPC to reset a user's password directly in auth.users
-- This is only accessible to admins.
CREATE OR REPLACE FUNCTION public.admin_reset_password(target_user_id UUID, new_password TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  is_admin_user BOOLEAN;
BEGIN
  -- 1. Check if the caller is an admin
  SELECT EXISTS (
    SELECT 1 FROM public.system_users 
    WHERE id = auth.uid() AND role = 'ADMIN'
  ) INTO is_admin_user;

  IF NOT is_admin_user THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem redefinir senhas.';
  END IF;

  -- 2. Update the password in auth.users using crypt and gen_salt from pgcrypto
  -- Supabase Auth passwords are stored in encrypted_password column
  -- We update updated_at to ensure full consistency
  UPDATE auth.users 
  SET 
    encrypted_password = crypt(new_password, gen_salt('bf')),
    updated_at = timezone('utc'::text, now()),
    password_changed_at = timezone('utc'::text, now())
  WHERE id = target_user_id;

  RETURN true;
END;
$$;

-- Grant execution to authenticated users (the function itself checks for ADMIN role)
GRANT EXECUTE ON FUNCTION public.admin_reset_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_password(UUID, TEXT) TO service_role;
