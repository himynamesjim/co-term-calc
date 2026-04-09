# CoTerm Calculator MVP - Project Updates & Configuration

**Last Updated**: April 9, 2026

## Project Overview
A Co-Term Calculator application built with Next.js 16.2.3 that helps users calculate co-terming schedules for license agreements. Features include AI-powered chat assistance, auto-save functionality, and user authentication via Supabase.

---

## Current Configuration

### Environment Setup
- **Framework**: Next.js 16.2.3 with Webpack (Turbopack not supported on this platform)
- **Runtime**: Node.js with WASM bindings
- **Port**: http://localhost:3000
- **TypeScript**: Enabled

### Supabase Configuration
```
NEXT_PUBLIC_SUPABASE_URL=https://wbanwzenfuiugyakoufa.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (configured)
```

**Status**: ✅ Fully configured and integrated

### Database Schema
Table: `coterm_calculations`
- `id` (UUID, primary key)
- `user_id` (UUID, foreign key to auth.users)
- `title` (TEXT)
- `design_type` (TEXT, default: 'coterm-calc')
- `design_data` (JSONB)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Row Level Security**: Enabled with user-specific policies

---

## Key Features Implemented

### 1. Authentication System
- **Login/Signup Modal** ([components/auth-modal.tsx](components/auth-modal.tsx))
- **Supabase Integration** ([lib/supabase.ts](lib/supabase.ts))
- **Session Management** with auto-refresh
- **User-specific data access** via RLS policies

### 2. Auto-Save Functionality
- **Debounce Time**: 1 second
- **Trigger**: Project name field + any calculator changes
- **API Endpoint**: `/api/save-design`
- **Behavior**: Creates new record or updates existing based on project name

### 3. AI Chat Assistant
- **API Endpoint**: `/api/chat-coterm`
- **Capabilities**:
  - Set agreement start date (natural language)
  - Set co-term start date
  - Set agreement term months
  - Add license line items
  - Modify calculator values via commands
- **Example Commands**:
  - "Set start date to 10/12/2024"
  - "Add a license for Microsoft 365 with 100 licenses at $5000 annual cost"
  - "Set agreement term to 36 months"

### 4. Responsive Layout
- **Left Sidebar**: Navigation, login, saved calculations (collapsible)
- **Main Area**: Calculator with dynamic sizing
- **Right Sidebar**: AI Chat Assistant (collapsible)
- **Breakpoints**:
  - Mobile: < 1024px (right sidebar hidden)
  - Medium: 1024-1400px (320px right sidebar)
  - Large: > 1400px (380px right sidebar)

### 5. Calculator Features
- **Step 1**: Agreement details with project name field
- **Step 2**: License line items with responsive grid layout
  - Mobile: 1 column
  - Medium (md): 2 columns
  - Extra Large (xl): 4 columns
- **Step 3**: Calculation results
- **Date Inputs**: Support both manual typing and calendar picker
- **Dark Theme**: Default and only theme

---

## Removed Components

The following components were removed from the UI but stub files exist to prevent build errors:

1. **Site Header** (`components/site-header.tsx`) - Removed from layout
2. **Nav Menu** (`components/nav-menu.tsx`) - Replaced with sidebar navigation
3. **Paywall Modal** (`components/paywall-modal.tsx`) - Not needed
4. **Footer** - "Powered by InterPeak" removed

---

## API Routes

### `/api/save-design` (POST)
**Purpose**: Save/update co-term calculations to Supabase

**Request Body**:
```json
{
  "title": "Project Name",
  "designData": { /* calculator state */ },
  "designType": "coterm-calc",
  "userId": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "design": { /* saved design object */ }
}
```

### `/api/chat-coterm` (POST)
**Purpose**: Process AI chat messages and return calculator actions

**Request Body**:
```json
{
  "messages": [{ "role": "user", "content": "message" }],
  "licenseData": [ /* current licenses */ ]
}
```

**Response**:
```json
{
  "message": "AI response",
  "actions": [
    {
      "type": "set_agreement_start_date",
      "data": { "date": "2024-10-12" }
    }
  ]
}
```

---

## Known Issues & Fixes Applied

### Issue 1: Turbopack Native Bindings Error
**Error**: `segment '__TEXT' load command content extends beyond end of file`
**Fix**: Use `--webpack` flag when starting dev server
**Command**: `npx next dev --webpack`

### Issue 2: Date Picker Gesture Error
**Error**: `NotAllowedError: HTMLInputElement::showPicker() requires a user gesture`
**Fix**: Removed `showPicker()` call, rely on native browser behavior for date inputs

### Issue 3: License Items Layout Cramped
**Fix**: Changed grid breakpoints from `lg:grid-cols-4` to `md:grid-cols-2 xl:grid-cols-4`

### Issue 4: Invalid Supabase URL Error
**Fix**: Added placeholder values and `isSupabaseConfigured` flag in [lib/supabase.ts](lib/supabase.ts:7-11)

---

## Database Setup Instructions

**Important**: The SQL schema must be executed in your Supabase dashboard to enable data persistence.

1. Open your Supabase project: https://app.supabase.com
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the entire contents of [supabase-schema.sql](supabase-schema.sql)
5. Click **Run**
6. Verify the table was created in **Table Editor** → **coterm_calculations**

---

## File Structure

### Core Application Files
- [app/page.tsx](app/page.tsx) - Main calculator component with all logic
- [app/layout.tsx](app/layout.tsx) - Root layout with providers
- [app/globals.css](app/globals.css) - Global styles and Tailwind config

### Components
- [components/auth-modal.tsx](components/auth-modal.tsx) - Login/signup modal
- [components/site-header.tsx](components/site-header.tsx) - Stub (removed from UI)
- [components/nav-menu.tsx](components/nav-menu.tsx) - Stub (removed from UI)
- [components/paywall-modal.tsx](components/paywall-modal.tsx) - Stub (removed from UI)

### API Routes
- [app/api/chat-coterm/route.ts](app/api/chat-coterm/route.ts) - AI chat endpoint
- [app/api/save-design/route.ts](app/api/save-design/route.ts) - Save calculations endpoint

### Utilities & Config
- [lib/supabase.ts](lib/supabase.ts) - Supabase client and auth helpers
- [.env.local](.env.local) - Environment variables (Supabase credentials)
- [supabase-schema.sql](supabase-schema.sql) - Database schema
- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) - Setup instructions

---

## Development Workflow

### Starting the Dev Server
```bash
npx next dev --webpack
```

### Stopping the Dev Server
```bash
# Find and kill processes on port 3000
lsof -ti:3000 | xargs kill -9
```

### Installing Dependencies
```bash
npm install
```

---

## Next Steps & Pending Tasks

1. ✅ **Supabase Configuration** - COMPLETED
2. ⚠️ **Run Database Schema** - User needs to execute SQL in Supabase dashboard
3. ⏳ **Test Authentication** - Verify login/signup works after schema is run
4. ⏳ **Test Auto-Save** - Verify calculations save to database
5. ⏳ **Test Saved Calculations List** - Verify sidebar shows user's saved projects

---

## Testing Checklist

Once the database schema is executed:

- [ ] Open http://localhost:3000
- [ ] Click "Login / Sign Up" in left sidebar
- [ ] Create a new account with email/password
- [ ] Check email for confirmation link
- [ ] Confirm email and login
- [ ] Enter a project name in Step 1
- [ ] Fill out calculator fields
- [ ] Verify auto-save occurs (check browser console)
- [ ] Refresh page and verify data persists
- [ ] Check left sidebar for saved calculations list
- [ ] Test AI chat commands:
  - [ ] "Set start date to [date]"
  - [ ] "Add a license for [product]"
  - [ ] "Set term to [number] months"

---

## Important Notes

- The `.env.local` file is in `.gitignore` - never commit credentials
- The anon key is safe to use client-side (it's the "public" key)
- Row Level Security ensures users can only access their own data
- Auto-save triggers 1 second after user stops typing in project name field
- Dev server must use `--webpack` flag due to platform limitations

---

## Contact & Support

For issues or questions about this project:
- Check [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for Supabase configuration help
- Review browser console for detailed error messages
- Verify environment variables are loaded (`cat .env.local`)
- Ensure dev server was restarted after changing `.env.local`
