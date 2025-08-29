-- Add project_manager to the role check constraint
ALTER TABLE user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE user_profiles 
ADD CONSTRAINT user_profiles_role_check 
CHECK (role IN ('manager', 'installer', 'project_manager'));

-- Update any existing project managers (if needed)
-- This is safe to run even if there are no project managers yet
UPDATE user_profiles 
SET role = 'project_manager' 
WHERE role = 'project_manager';