-- Fix signup by adding missing INSERT policy for user_profiles

-- Add INSERT policy to allow new user creation via trigger
CREATE POLICY "Allow user profile creation during signup" ON user_profiles
  FOR INSERT 
  WITH CHECK (true);

-- Alternative: If the above is too permissive, use this more restrictive version:
-- CREATE POLICY "Allow user profile creation during signup" ON user_profiles
--   FOR INSERT 
--   WITH CHECK (auth.uid() = id);

-- Verify the policy was created
SELECT 
  policyname,
  cmd,
  permissive,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'user_profiles' AND cmd = 'INSERT';