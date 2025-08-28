-- Create the missing user_profiles table

-- 1. Create user_profiles table
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'installer' CHECK (role IN ('manager', 'installer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create the policies (based on what we saw working)
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Manager can view all profiles" ON user_profiles
  FOR SELECT USING (auth.uid()::text = '34caffcb-4534-43c6-8a49-d43ceb4b243f');

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Manager can update all profiles" ON user_profiles
  FOR UPDATE USING (auth.uid()::text = '34caffcb-4534-43c6-8a49-d43ceb4b243f');

CREATE POLICY "Allow user registration" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. Create index for performance
CREATE INDEX idx_user_profiles_role ON user_profiles(role);

-- 5. Verify table was created
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;