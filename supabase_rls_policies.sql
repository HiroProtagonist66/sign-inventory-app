-- Row Level Security Policies for Sign Inventory App
-- Run these in your Supabase SQL Editor

-- First, ensure RLS is enabled on the tables
ALTER TABLE inventory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_sign_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sign_descriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (optional, for clean setup)
DROP POLICY IF EXISTS "Users can view all sites" ON sites;
DROP POLICY IF EXISTS "Users can view all project areas" ON project_areas;
DROP POLICY IF EXISTS "Users can view all sign descriptions" ON sign_descriptions;
DROP POLICY IF EXISTS "Users can view all project signs" ON project_sign_catalog;
DROP POLICY IF EXISTS "Authenticated users can create inventory sessions" ON inventory_sessions;
DROP POLICY IF EXISTS "Users can view all inventory sessions" ON inventory_sessions;
DROP POLICY IF EXISTS "Authenticated users can create inventory logs" ON inventory_log;
DROP POLICY IF EXISTS "Users can view all inventory logs" ON inventory_log;

-- SITES table policies
-- All authenticated users can view all sites
CREATE POLICY "Users can view all sites" ON sites
FOR SELECT
TO authenticated
USING (true);

-- PROJECT_AREAS table policies
-- All authenticated users can view all project areas
CREATE POLICY "Users can view all project areas" ON project_areas
FOR SELECT
TO authenticated
USING (true);

-- SIGN_DESCRIPTIONS table policies
-- All authenticated users can view all sign descriptions
CREATE POLICY "Users can view all sign descriptions" ON sign_descriptions
FOR SELECT
TO authenticated
USING (true);

-- PROJECT_SIGN_CATALOG table policies
-- All authenticated users can view all project signs
CREATE POLICY "Users can view all project signs" ON project_sign_catalog
FOR SELECT
TO authenticated
USING (true);

-- INVENTORY_SESSIONS table policies
-- Authenticated users can create inventory sessions
CREATE POLICY "Authenticated users can create inventory sessions" ON inventory_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- All authenticated users can view all inventory sessions
-- (You might want to restrict this to only their own sessions later)
CREATE POLICY "Users can view all inventory sessions" ON inventory_sessions
FOR SELECT
TO authenticated
USING (true);

-- INVENTORY_LOG table policies
-- Authenticated users can create inventory logs
CREATE POLICY "Authenticated users can create inventory logs" ON inventory_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- All authenticated users can view all inventory logs
-- (You might want to restrict this to only their own logs later)
CREATE POLICY "Users can view all inventory logs" ON inventory_log
FOR SELECT
TO authenticated
USING (true);

-- Optional: If you want users to only see their own data, use these policies instead:
-- CREATE POLICY "Users can view own inventory sessions" ON inventory_sessions
-- FOR SELECT
-- TO authenticated
-- USING (user_id = auth.uid());

-- CREATE POLICY "Users can view own inventory logs" ON inventory_log
-- FOR SELECT
-- TO authenticated
-- USING (user_id = auth.uid());