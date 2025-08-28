-- Fix installer signup issue
-- This ensures new users can sign up as installers

-- 1. Verify and fix the trigger function to only use 'installer' or 'manager'
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE 
      -- First user becomes manager, all others become installers
      WHEN (SELECT COUNT(*) FROM user_profiles WHERE role = 'manager') = 0 THEN 'manager'
      ELSE 'installer'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Recreate the trigger to ensure it's working
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. Test that the constraint allows both roles
-- This should show the current constraint
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'user_profiles'::regclass 
  AND conname LIKE '%role%';