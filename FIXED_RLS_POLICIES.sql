-- Fixed RLS Policies for User Profiles (No Infinite Recursion)
-- Run this in your Supabase SQL Editor

-- 1. Drop all existing problematic policies
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Managers can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Managers can update any profile" ON user_profiles;

-- 2. Create fixed policies without recursion

-- Policy 1: Users can always view their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Policy 2: Users can update their own profile  
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Policy 3: Specific manager (you) can view all profiles
-- Replace with your actual user ID from the console logs
CREATE POLICY "Manager can view all profiles" ON user_profiles
  FOR SELECT USING (auth.uid()::text = '34caffcb-4534-43c6-8a49-d43ceb4b243f');

-- Policy 4: Specific manager (you) can update any profile
CREATE POLICY "Manager can update all profiles" ON user_profiles
  FOR UPDATE USING (auth.uid()::text = '34caffcb-4534-43c6-8a49-d43ceb4b243f');

-- Policy 5: Allow new user registration (INSERT)
CREATE POLICY "Allow user registration" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. Fix other table policies that might reference user_profiles

-- Fix user_site_assignments policies
DROP POLICY IF EXISTS "Managers can view all assignments" ON user_site_assignments;
DROP POLICY IF EXISTS "Managers can create assignments" ON user_site_assignments;
DROP POLICY IF EXISTS "Managers can update assignments" ON user_site_assignments;
DROP POLICY IF EXISTS "Managers can delete assignments" ON user_site_assignments;

-- Recreate with direct manager check (no user_profiles lookup)
CREATE POLICY "Manager can manage all assignments" ON user_site_assignments
  FOR ALL USING (auth.uid()::text = '34caffcb-4534-43c6-8a49-d43ceb4b243f');

-- Users can view their own assignments (no recursion here)
CREATE POLICY "Users can view own assignments" ON user_site_assignments
  FOR SELECT USING (user_id = auth.uid());

-- 4. Fix sites policy to avoid recursion
DROP POLICY IF EXISTS "Users can view assigned sites" ON sites;

-- Recreate sites policy with direct checks
CREATE POLICY "Manager can view all sites" ON sites
  FOR SELECT USING (auth.uid()::text = '34caffcb-4534-43c6-8a49-d43ceb4b243f');

-- Installers can view sites they're assigned to
CREATE POLICY "Users can view assigned sites" ON sites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_site_assignments 
      WHERE user_id = auth.uid() 
      AND site_id = sites.id
    )
  );

-- 5. Verify policies are working
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('user_profiles', 'user_site_assignments', 'sites')
ORDER BY tablename, policyname;

-- Test query (should work without recursion)
SELECT id, email, role FROM user_profiles WHERE id = auth.uid();

COMMENT ON TABLE user_profiles IS 'Fixed RLS policies - no infinite recursion';