# Row Level Security (RLS) Configuration

## Current Issue
The app is encountering a 401 Unauthorized error when trying to save inventory data because the Supabase tables have Row Level Security (RLS) policies that require authentication.

## Solutions

### Option 1: Modify RLS Policies in Supabase (Recommended for Development)

1. Go to your Supabase dashboard at https://supabase.com/dashboard
2. Navigate to your project
3. Go to **Authentication > Policies**
4. For the following tables, you need to create or modify policies:
   - `inventory_sessions`
   - `inventory_log`

#### Create INSERT policies that allow anonymous access:

For `inventory_sessions`:
```sql
-- Allow anonymous inserts to inventory_sessions
CREATE POLICY "Allow anonymous insert" ON inventory_sessions
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anonymous reads from inventory_sessions
CREATE POLICY "Allow anonymous select" ON inventory_sessions
FOR SELECT
TO anon
USING (true);
```

For `inventory_log`:
```sql
-- Allow anonymous inserts to inventory_log
CREATE POLICY "Allow anonymous insert" ON inventory_log
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anonymous reads from inventory_log
CREATE POLICY "Allow anonymous select" ON inventory_log
FOR SELECT
TO anon
USING (true);
```

### Option 2: Disable RLS Temporarily (Quick Fix)

In Supabase SQL Editor, run:
```sql
-- Disable RLS on the tables
ALTER TABLE inventory_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_log DISABLE ROW LEVEL SECURITY;
```

To re-enable later:
```sql
-- Re-enable RLS
ALTER TABLE inventory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_log ENABLE ROW LEVEL SECURITY;
```

### Option 3: Implement User Authentication (Production Solution)

For production, you should implement proper authentication:

1. Add Supabase Auth to your app
2. Create login/signup pages
3. Ensure users are authenticated before accessing inventory features
4. Modify RLS policies to use `auth.uid()` for user-specific access

Example RLS policy for authenticated users:
```sql
-- Allow users to insert their own records
CREATE POLICY "Users can insert own records" ON inventory_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own records
CREATE POLICY "Users can view own records" ON inventory_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
```

## Current Implementation

The app currently tries to use the authenticated user's ID if available, but falls back to `null` if no user is authenticated. This allows the app to work with policies that permit anonymous access.