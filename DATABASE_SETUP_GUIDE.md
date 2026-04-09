# Database Setup Guide - URGENT

Your calculator is trying to save data, but the database table doesn't exist yet. Follow these steps to fix it:

## Current Error
```
Could not find the table 'public.coterm_calculations' in the schema cache
```

## Solution - Create the Database Table

### Step 1: Open Supabase SQL Editor
1. Go to https://app.supabase.com
2. Click on your project: **wbanwzenfuiugyakoufa**
3. In the left sidebar, click **SQL Editor** (icon looks like `</>`)
4. Click the **New Query** button (top right)

### Step 2: Copy the SQL Schema
1. Open the file [supabase-schema.sql](supabase-schema.sql) in this project
2. Copy ALL the contents (lines 1-58)
3. Paste into the SQL Editor query window in Supabase

### Step 3: Run the SQL
1. Click the **Run** button (or press Cmd/Ctrl + Enter)
2. You should see: ✅ **Success. No rows returned**

### Step 4: Verify the Table Was Created
1. In the left sidebar, click **Table Editor**
2. You should see a new table called **coterm_calculations**
3. Click on it to see the columns:
   - id (uuid)
   - user_id (uuid)
   - title (text)
   - design_type (text)
   - design_data (jsonb)
   - created_at (timestamptz)
   - updated_at (timestamptz)

### Step 5: Refresh Your App
1. Go back to http://localhost:3000
2. Hard refresh the page (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
3. The errors in the console should be gone

## What This Does

The SQL script creates:
- **Table**: `coterm_calculations` - stores your calculator data
- **Indexes**: Speed up queries by user_id and updated_at
- **Row Level Security**: Only you can see your own calculations
- **Policies**: Allow users to create, read, update, and delete their own data
- **Trigger**: Automatically updates the `updated_at` timestamp when you save

## Testing After Setup

1. **Login** - Click "Login / Sign Up" in the left sidebar
2. **Create Account** - Use any email/password
3. **Add Project Name** - Type a name in Step 1
4. **Wait 1 Second** - Auto-save will trigger
5. **Check Console** - Should see successful save message (F12 → Console tab)
6. **Refresh Page** - Your data should persist

## Troubleshooting

### Error: "relation already exists"
- The table was already created. This is fine! The script uses `IF NOT EXISTS` so it's safe to run multiple times.

### Error: "permission denied"
- Make sure you're logged into the correct Supabase project
- Check that you have admin access to the project

### Still seeing "table not found" error
1. Verify the table exists in **Table Editor**
2. Hard refresh your browser (clear cache)
3. Restart the dev server:
   ```bash
   lsof -ti:3000 | xargs kill -9
   npx next dev --webpack
   ```

## Quick Reference

**Your Supabase Project**: https://wbanwzenfuiugyakoufa.supabase.co
**Dashboard**: https://app.supabase.com
**Local App**: http://localhost:3000

---

**Need help?** Check the browser console (F12) for detailed error messages.
