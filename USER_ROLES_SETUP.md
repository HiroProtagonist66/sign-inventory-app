# 👥 User Roles System Setup Guide

## 🎯 **System Overview**

Your Sign Inventory App now has a comprehensive user roles system with:

- **👔 Manager Role (You)**: Can see all sites, assign installers to specific sites, manage users
- **🔧 Installer Role**: Can only see assigned sites, perform inventory tasks

---

## 🚀 **Step 1: Database Setup**

**Run this SQL in your Supabase dashboard:**

1. Go to your Supabase project → SQL Editor
2. Copy and paste the entire contents of `user_roles_schema.sql`
3. Click "Run" to execute all the database changes

This will create:
- `user_profiles` table for user roles
- `user_site_assignments` table for site assignments
- All necessary RLS policies
- Trigger for automatic user registration

---

## 👑 **Step 2: Set Yourself as Manager**

After running the schema, you need to set your account as manager:

### **Option A: First User Auto-Manager**
If you're the first user to register, you'll automatically be set as manager.

### **Option B: Manual Assignment**
If you already have an account, run this SQL (replace with your email):

```sql
-- Update your user to be manager
UPDATE user_profiles 
SET role = 'manager' 
WHERE email = 'your-email@example.com';

-- Or if you need to insert a profile
INSERT INTO user_profiles (id, email, full_name, role)
SELECT id, email, 'Your Name', 'manager'
FROM auth.users 
WHERE email = 'your-email@example.com'
ON CONFLICT (id) DO UPDATE SET role = 'manager';
```

---

## 📱 **Step 3: How the System Works**

### **As Manager (You):**
1. **Access Manager Dashboard**: Click the ⚙️ settings icon on the home page
2. **Assign Users to Sites**: Select installer + site, click "Assign User"
3. **View All Sites**: You can see and access all sites in the system
4. **Manage Assignments**: Remove users from sites as needed

### **As Installer:**
1. **Limited Site Access**: Only sees sites assigned by manager
2. **Standard Inventory**: Same inventory functionality, just restricted sites
3. **No Management Access**: Cannot access manager dashboard

---

## 🔧 **Step 4: Managing Users**

### **Adding New Installers:**
1. Have them register normally through the app
2. They'll automatically be assigned "installer" role
3. Use Manager Dashboard to assign them to specific sites

### **Assigning Sites:**
1. Go to Manager Dashboard (/manager)
2. Use "Assign User to Site" section
3. Select installer and site, click "Assign User"

### **Removing Assignments:**
1. In Manager Dashboard, find the user
2. Click the trash icon (🗑️) next to the site assignment

---

## 🛡️ **Security Features**

### **Row Level Security (RLS):**
- ✅ Installers can only see assigned sites
- ✅ Managers can see all data
- ✅ Users can only modify their own inventory records
- ✅ Only managers can create/modify assignments

### **UI Protection:**
- ✅ Manager dashboard only accessible by managers
- ✅ Role-specific messaging and navigation
- ✅ Automatic redirects for unauthorized access

---

## 📊 **Manager Dashboard Features**

### **User Assignment Interface:**
- Dropdown lists of installers and sites
- One-click assignment process
- Visual confirmation of assignments

### **Assignment Overview:**
- See all users and their assigned sites
- Remove assignments with one click
- User statistics and site coverage

### **Statistics Panel:**
- Total installers count
- Total sites count
- Active assignments count

---

## 🧪 **Testing the System**

### **Test as Manager:**
1. ✅ Access Manager Dashboard
2. ✅ See all sites on home page
3. ✅ Assign installer to a site
4. ✅ Remove assignment

### **Test as Installer:**
1. ✅ Register new user (auto-installer role)
2. ✅ See "No projects assigned" message
3. ✅ Cannot access /manager route
4. ✅ After assignment, see only assigned sites

---

## 📋 **Quick Reference**

### **Key URLs:**
- **Home/Site Selection**: `/`
- **Manager Dashboard**: `/manager`
- **Areas Selection**: `/areas`
- **Inventory**: `/inventory`

### **Database Tables:**
- `user_profiles` - User roles and information
- `user_site_assignments` - Site assignment relationships
- `sites` - Project sites (existing)
- `inventory_log` - Inventory records (existing)

### **User Roles:**
- `manager` - Full access, can assign sites
- `installer` - Limited to assigned sites only

---

## 🚨 **Troubleshooting**

### **Manager Can't Access Dashboard:**
```sql
-- Check your role
SELECT role FROM user_profiles WHERE email = 'your-email@example.com';

-- Update to manager if needed
UPDATE user_profiles SET role = 'manager' WHERE email = 'your-email@example.com';
```

### **Installer Not Seeing Assigned Sites:**
1. Check assignment exists in Manager Dashboard
2. Refresh the installer's browser
3. Check RLS policies are enabled

### **Database Connection Issues:**
1. Verify Supabase environment variables
2. Check RLS policies are properly applied
3. Ensure user authentication is working

---

## 🔄 **Deployment Status**

✅ **Code Deployed**: Latest version is live on Vercel  
✅ **Database Schema**: Ready to run in Supabase  
✅ **UI Components**: Manager dashboard and role-based navigation  
✅ **Security**: Comprehensive RLS policies implemented  

**Next Step**: Run the SQL schema in your Supabase dashboard and start assigning sites to installers!

---

*Your sign inventory system now provides enterprise-level user management with role-based access control.*