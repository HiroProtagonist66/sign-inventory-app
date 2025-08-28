-- Test if the trigger function exists and works properly

-- 1. Check if the trigger function exists
SELECT 
  p.proname as function_name,
  p.prosrc as function_source,
  p.provolatile as volatility
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'handle_new_user'
  AND n.nspname = 'public';

-- 2. Check if the trigger exists and is enabled
SELECT 
  t.tgname as trigger_name,
  t.tgenabled as enabled,
  c.relname as table_name,
  p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgname = 'on_auth_user_created';

-- 3. Test the function manually (safe test - won't create actual user)
-- This will show us if the function has syntax errors
SELECT handle_new_user();

-- 4. Check what the current first manager count is
SELECT COUNT(*) as manager_count FROM user_profiles WHERE role = 'manager';

-- 5. Try to manually insert a test user profile (to see exact error)
-- Replace the UUID with a test one - this should fail with the real error message
-- INSERT INTO user_profiles (id, email, full_name, role) 
-- VALUES ('00000000-0000-0000-0000-000000000001', 'test@example.com', 'Test User', 'installer');

-- 6. Check if there are any other constraints that might be failing
SELECT 
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'user_profiles';