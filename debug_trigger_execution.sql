-- Debug trigger execution - check what happens during signup

-- 1. Add logging to the trigger function to see if it executes
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Log that the trigger is firing
  RAISE LOG 'handle_new_user trigger fired for user: %', NEW.id;
  
  -- Try the insert and catch any errors
  BEGIN
    INSERT INTO user_profiles (id, email, full_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      CASE 
        -- First user becomes manager, others become installers
        WHEN (SELECT COUNT(*) FROM user_profiles WHERE role = 'manager') = 0 THEN 'manager'
        ELSE 'installer'
      END
    );
    
    RAISE LOG 'Successfully inserted user profile for: %', NEW.email;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log the exact error
    RAISE LOG 'Error inserting user profile: % - %', SQLSTATE, SQLERRM;
    -- Re-raise the error so signup fails with details
    RAISE;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Check current manager count
SELECT COUNT(*) as manager_count FROM user_profiles WHERE role = 'manager';

-- 3. Check all current policies on user_profiles
SELECT 
  policyname,
  cmd,
  permissive,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'user_profiles'
ORDER BY cmd, policyname;