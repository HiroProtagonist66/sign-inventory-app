-- Safe migration to add project_manager role
-- Step 1: First run the check_constraints.sql to see existing constraints

-- Step 2: Drop the existing constraint (replace CONSTRAINT_NAME with actual name from Step 1)
-- Example: ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_role_check;

-- Step 3: Add the new constraint with project_manager
ALTER TABLE user_profiles 
ADD CONSTRAINT user_profiles_role_check 
CHECK (role IN ('manager', 'installer', 'project_manager'));

-- Alternative approach if you can't find the constraint name:
-- This will remove ALL check constraints and recreate the one we need
/*
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check CASCADE;
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_check CASCADE;

-- Recreate the role constraint with project_manager
ALTER TABLE user_profiles 
ADD CONSTRAINT user_profiles_role_check 
CHECK (role IN ('manager', 'installer', 'project_manager'));
*/