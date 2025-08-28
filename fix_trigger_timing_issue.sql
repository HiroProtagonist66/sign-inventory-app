-- Fix trigger timing issue - use AFTER INSERT instead of during transaction

-- 1. Drop the existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Update the trigger function to handle the constraint properly
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert with explicit error handling for foreign key constraint
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE 
      -- First user becomes manager, others become installers
      WHEN (SELECT COUNT(*) FROM public.user_profiles WHERE role = 'manager') = 0 THEN 'manager'
      ELSE 'installer'
    END
  );
  
  RETURN NEW;
EXCEPTION 
  WHEN foreign_key_violation THEN
    -- Log the error but don't fail the signup
    RAISE WARNING 'Foreign key violation creating user profile for %: %', NEW.email, SQLERRM;
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log any other errors
    RAISE WARNING 'Error creating user profile for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recreate the trigger with AFTER INSERT
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 4. Alternative: If the above still doesn't work, we can create a deferred constraint trigger
-- This ensures the auth.users record is committed first

-- First, let's also try making this trigger DEFERRABLE
-- (Uncomment these lines if the above trigger still fails)

-- ALTER TABLE user_profiles 
-- DROP CONSTRAINT user_profiles_id_fkey;

-- ALTER TABLE user_profiles 
-- ADD CONSTRAINT user_profiles_id_fkey 
-- FOREIGN KEY (id) REFERENCES auth.users(id) 
-- ON DELETE CASCADE 
-- DEFERRABLE INITIALLY DEFERRED;

-- Verify the trigger was created
SELECT 
  t.tgname as trigger_name,
  t.tgenabled as enabled,
  t.tgtype as trigger_type
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE t.tgname = 'on_auth_user_created' 
  AND c.relname = 'users';