-- User Roles and Site Assignment Schema
-- Run this in your Supabase SQL editor

-- 1. Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'installer' CHECK (role IN ('manager', 'installer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create user_site_assignments table  
CREATE TABLE IF NOT EXISTS user_site_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  assigned_by UUID REFERENCES user_profiles(id) NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, site_id)
);

-- 3. Create function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 5. Row Level Security Policies

-- Enable RLS on new tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_site_assignments ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Managers can view all profiles" ON user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Managers can update any profile" ON user_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Site assignment policies
CREATE POLICY "Managers can view all assignments" ON user_site_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Users can view their own assignments" ON user_site_assignments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Managers can create assignments" ON user_site_assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Managers can update assignments" ON user_site_assignments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Managers can delete assignments" ON user_site_assignments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- 6. Update sites table RLS to respect assignments
DROP POLICY IF EXISTS "Authenticated users can read sites" ON sites;
CREATE POLICY "Users can view assigned sites" ON sites
  FOR SELECT USING (
    -- Managers can see all sites
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'manager'
    )
    OR 
    -- Installers can only see assigned sites
    EXISTS (
      SELECT 1 FROM user_site_assignments usa
      JOIN user_profiles up ON up.id = usa.user_id
      WHERE usa.user_id = auth.uid() 
      AND usa.site_id = sites.id
      AND up.role = 'installer'
    )
  );

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_site_assignments_user_id ON user_site_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_site_assignments_site_id ON user_site_assignments(site_id);

-- 8. Insert your user as manager (replace with your actual email)
-- You'll need to run this after you've registered in the app
-- INSERT INTO user_profiles (id, email, full_name, role)
-- SELECT id, email, 'Your Name', 'manager'
-- FROM auth.users 
-- WHERE email = 'your-email@example.com'
-- ON CONFLICT (id) DO UPDATE SET role = 'manager';

COMMENT ON TABLE user_profiles IS 'User profiles with role-based access control';
COMMENT ON TABLE user_site_assignments IS 'Assignments of installers to specific sites';
COMMENT ON COLUMN user_profiles.role IS 'User role: manager or installer';