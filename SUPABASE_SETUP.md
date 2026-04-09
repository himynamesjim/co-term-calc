# Supabase Setup Instructions

This application uses Supabase for authentication and data storage. Follow these steps to set it up:

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in your project details:
   - **Name**: CoTerm Calculator (or any name you prefer)
   - **Database Password**: Choose a strong password
   - **Region**: Select the region closest to your users
4. Click "Create new project" and wait for it to be ready (~2 minutes)

## 2. Get Your API Credentials

1. Once your project is ready, go to **Settings** (gear icon) → **API**
2. Copy the following values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (the long string under "Project API keys")

## 3. Configure Environment Variables

1. Open the `.env.local` file in the project root
2. Replace the placeholder values with your actual credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url-here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## 4. Set Up the Database

1. In your Supabase project, go to **SQL Editor** (on the left sidebar)
2. Click "New Query"
3. Copy and paste the entire contents of `supabase-schema.sql` into the editor
4. Click "Run" to execute the SQL

This will create:
- The `coterm_calculations` table to store user calculations
- Row Level Security (RLS) policies so users can only see their own data
- Automatic timestamp updates
- Proper indexes for performance

## 5. Enable Email Authentication (Optional but Recommended)

1. Go to **Authentication** → **Providers**
2. Make sure **Email** is enabled (it should be by default)
3. Configure email settings:
   - For development, Supabase provides a test email service
   - For production, configure your own SMTP settings

## 6. Test the Integration

1. Restart your Next.js development server:
   ```bash
   npm run dev
   ```

2. Open your app and try:
   - Click "Login / Sign Up" in the left sidebar
   - Create a new account
   - Check your email for the confirmation link
   - Login and create a Co-Term calculation
   - Verify it saves and appears in the left sidebar

## Troubleshooting

### "User ID is required" error
- Make sure you're logged in
- Check that your environment variables are set correctly
- Restart the dev server after changing `.env.local`

### Database errors
- Verify the SQL schema was executed successfully
- Check the RLS policies are enabled
- Go to **Table Editor** → **coterm_calculations** to view the table

### Authentication not working
- Verify your Supabase URL and anon key are correct
- Check browser console for detailed error messages
- Ensure Email provider is enabled in Authentication settings

## Security Notes

- The `.env.local` file is already in `.gitignore` - never commit your credentials
- The anon key is safe to use client-side (it's called "public" key)
- Row Level Security ensures users can only access their own data
- For production, consider adding rate limiting and additional security measures

## Next Steps

- Customize the email templates in Supabase Auth settings
- Set up password reset functionality
- Add social login providers (Google, GitHub, etc.)
- Configure production email service (SendGrid, Mailgun, etc.)
