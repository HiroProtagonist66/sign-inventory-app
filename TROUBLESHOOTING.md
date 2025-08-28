# 🔧 Troubleshooting Guide

## Issues Fixed ✅

- **TypeScript compilation errors** - All resolved
- **Deployment failures** - Fixed and pushed to Vercel
- **Site interface missing properties** - Added optional location field

---

## 🧪 Testing Your User Roles System

### **Step 1: Check Your Manager Status**

Run this SQL in your Supabase dashboard to verify your role:

```sql
-- Check your user profile
SELECT * FROM user_profiles WHERE email = 'your-email@example.com';

-- If no results, create your profile as manager:
INSERT INTO user_profiles (id, email, full_name, role)
SELECT id, email, 'Your Name', 'manager'
FROM auth.users 
WHERE email = 'your-email@example.com'
ON CONFLICT (id) DO UPDATE SET role = 'manager';
```

### **Step 2: Verify Projects/Sites Exist**

```sql
-- Check if you have any sites in the database
SELECT * FROM sites LIMIT 10;

-- If no sites exist, add a test site:
INSERT INTO sites (name, location) 
VALUES ('Test Project', 'Test Location');
```

### **Step 3: Debug "Failed to Load Projects" Error**

This could be caused by:
1. **No sites in database** (most likely)
2. **RLS policies too restrictive**
3. **User profile not created**

**Quick fix - temporarily disable RLS on sites:**
```sql
-- Disable RLS temporarily to test
ALTER TABLE sites DISABLE ROW LEVEL SECURITY;
```

If sites load after this, the issue is with RLS policies. Re-enable with:
```sql
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
```

### **Step 4: Check User Profile Creation**

The app should auto-create profiles, but check with:
```sql
-- See all user profiles
SELECT up.email, up.role, up.created_at
FROM user_profiles up
ORDER BY up.created_at DESC;
```

---

## 🎯 Expected Behavior

### **As Manager (You):**
- ✅ Should see your role displayed under "Select Project" 
- ✅ Should see settings ⚙️ icon next to WiFi indicator
- ✅ Should be able to access `/manager` dashboard
- ✅ Should see all sites (if any exist)

### **As Installer:**
- ✅ Should see "installer" role displayed
- ✅ Should NOT see settings icon
- ✅ Should get "access denied" if trying `/manager`
- ✅ Should only see assigned sites

---

## 🚨 Common Issues & Solutions

### **"Failed to load projects"**
**Cause**: No sites in database or RLS blocking access
**Solution**: Add test site or check RLS policies

### **No settings icon visible**
**Cause**: User profile role is not 'manager'
**Solution**: Update role in database manually

### **404 Deployment Error**
**Cause**: Build failure or deployment issue
**Solution**: Check latest commit - should be working now

### **Settings icon present but no dashboard access**
**Cause**: Route protection working correctly, but check user role
**Solution**: Verify manager role in database

---

## 📊 Quick Database Check

Run this comprehensive query to see your system status:

```sql
-- Complete system status
SELECT 
  'Sites' as table_name, 
  count(*) as count
FROM sites
UNION ALL
SELECT 
  'User Profiles' as table_name, 
  count(*) as count
FROM user_profiles
UNION ALL
SELECT 
  'Assignments' as table_name, 
  count(*) as count
FROM user_site_assignments;

-- Your user details
SELECT 
  u.email,
  up.role,
  up.created_at,
  CASE 
    WHEN up.role = 'manager' THEN 'Should see all sites & settings icon'
    WHEN up.role = 'installer' THEN 'Should see only assigned sites'
    ELSE 'Unknown role'
  END as expected_behavior
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.id
WHERE u.email = 'your-email@example.com';
```

---

## 🔄 Next Steps

1. **Check your user role** in the database
2. **Add test sites** if none exist
3. **Test the manager dashboard**
4. **Create test installer account** to verify restrictions

The latest deployment should resolve all previous issues. Let me know what you find!

---

*All TypeScript errors have been resolved and the system is ready for testing.*