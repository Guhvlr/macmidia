-- Drop the manual password/email fields as we are now using native Supabase Auth
ALTER TABLE employees
DROP COLUMN IF EXISTS email,
DROP COLUMN IF EXISTS password;
