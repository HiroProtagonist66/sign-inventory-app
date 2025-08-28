-- Add project_manager role to the user_roles enum
-- This allows project managers to view inventory dashboards and reports

-- First, check current enum values
SELECT enum_range(NULL::user_role);

-- Add project_manager to the enum (if not already present)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'project_manager';

-- Update RLS policies to allow project_managers to view inventory data
-- Project managers should have read access to all inventory-related tables

-- Update policy for inventory_log to allow project_manager read access
DROP POLICY IF EXISTS "Users can view all inventory logs" ON inventory_log;
CREATE POLICY "Users can view all inventory logs" ON inventory_log
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM user_profiles 
      WHERE role IN ('manager', 'project_manager')
    )
    OR auth.uid() = user_id
  );

-- Update policy for inventory_sessions to allow project_manager read access  
DROP POLICY IF EXISTS "Users can view all inventory sessions" ON inventory_sessions;
CREATE POLICY "Users can view all inventory sessions" ON inventory_sessions
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM user_profiles 
      WHERE role IN ('manager', 'project_manager')
    )
    OR auth.uid() = user_id
  );

-- Allow project managers to view all sites
DROP POLICY IF EXISTS "Authenticated users can view sites" ON sites;
CREATE POLICY "Authenticated users can view sites" ON sites
  FOR SELECT TO authenticated
  USING (true);

-- Allow project managers to view all project areas
DROP POLICY IF EXISTS "Authenticated users can view project areas" ON project_areas;
CREATE POLICY "Authenticated users can view project areas" ON project_areas
  FOR SELECT TO authenticated
  USING (true);

-- Allow project managers to view sign catalog
DROP POLICY IF EXISTS "Authenticated users can view sign catalog" ON project_sign_catalog;
CREATE POLICY "Authenticated users can view sign catalog" ON project_sign_catalog
  FOR SELECT TO authenticated
  USING (true);