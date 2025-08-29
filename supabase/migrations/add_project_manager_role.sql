-- First, drop the existing check constraint
-- The constraint name might vary, so let's find and drop it
DO $$ 
BEGIN
    -- Drop any existing role check constraint
    ALTER TABLE user_profiles 
    DROP CONSTRAINT IF EXISTS user_profiles_role_check;
    
    -- Some Supabase projects might have a different constraint name
    ALTER TABLE user_profiles 
    DROP CONSTRAINT IF EXISTS user_profiles_role_fkey;
    
    -- Or it might be a generic check constraint
    ALTER TABLE user_profiles 
    DROP CONSTRAINT IF EXISTS user_profiles_check;
EXCEPTION
    WHEN undefined_object THEN
        -- Constraint doesn't exist, that's fine
        NULL;
END $$;

-- Now add the new constraint with project_manager included
ALTER TABLE user_profiles 
ADD CONSTRAINT user_profiles_role_check 
CHECK (role IN ('manager', 'installer', 'project_manager'));