-- Debug signup issue - check all potential problems

-- 1. Check if user_profiles table exists and structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;

-- 2. Check if the trigger function exists and is valid
SELECT 
  p.proname as function_name,
  p.prosrc as function_source
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'handle_new_user';

-- 3. Check if the trigger exists on auth.users
SELECT 
  t.tgname as trigger_name,
  t.tgenabled as enabled,
  c.relname as table_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE t.tgname = 'on_auth_user_created';

-- 4. Check RLS policies on user_profiles that might block INSERT
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'user_profiles';

-- 5. Test if we can manually insert (this will help identify the exact issue)
-- Note: This is just to see what error we get - don't run if you have real users
-- INSERT INTO user_profiles (id, email, full_name, role) 
-- VALUES ('00000000-0000-0000-0000-000000000000', 'test@test.com', 'Test User', 'installer');

-- 6. Check if there are any foreign key constraints that might fail
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'user_profiles';

-- 7. Check if RLS is enabled and might be blocking
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'user_profiles';