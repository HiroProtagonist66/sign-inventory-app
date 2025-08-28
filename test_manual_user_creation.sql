-- Test manual user profile creation to isolate the issue

-- 1. Check if there are any additional constraints or triggers that might be failing
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'user_profiles'::regclass;

-- 2. Check for any other triggers on user_profiles
SELECT 
  t.tgname as trigger_name,
  t.tgenabled as enabled,
  c.relname as table_name,
  p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'user_profiles';

-- 3. Try a manual insert to see the exact error (using a fake UUID that won't conflict)
-- This should show us what constraint is failing
BEGIN;
  INSERT INTO user_profiles (id, email, full_name, role) 
  VALUES ('12345678-1234-1234-1234-123456789012', 'test@example.com', 'Test User', 'installer');
ROLLBACK;

-- 4. Check the exact trigger function definition
SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';