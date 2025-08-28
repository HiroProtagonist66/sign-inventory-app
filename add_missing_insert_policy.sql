-- Add only the missing INSERT policy for user_profiles signup

-- Check what INSERT policies currently exist
SELECT 
  policyname,
  cmd,
  with_check
FROM pg_policies 
WHERE tablename = 'user_profiles' AND cmd = 'INSERT';

-- Add the INSERT policy if it doesn't exist
DROP POLICY IF EXISTS "Allow user registration" ON user_profiles;
CREATE POLICY "Allow user registration" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Verify it was created
SELECT 
  policyname,
  cmd,
  with_check
FROM pg_policies 
WHERE tablename = 'user_profiles' AND cmd = 'INSERT';