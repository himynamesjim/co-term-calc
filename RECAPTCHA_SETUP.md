# Google reCAPTCHA v3 Setup Guide

This guide will help you set up Google reCAPTCHA v3 for the CoTerm Calculator to protect against spam sign-ups.

## Step 1: Register Your Site with Google reCAPTCHA

1. Go to the [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
2. Click the **"+"** button to create a new site
3. Fill in the registration form:
   - **Label**: CoTerm Calculator (or any name you prefer)
   - **reCAPTCHA type**: Select **reCAPTCHA v3**
   - **Domains**: Add your domains:
     - `co-term.com`
     - `www.co-term.com`
     - `localhost` (for local development)
   - **Owners**: Your Google account email
   - Accept the reCAPTCHA Terms of Service
4. Click **Submit**

## Step 2: Get Your Keys

After registration, you'll receive two keys:

1. **Site Key** (Public key) - Used in the frontend
2. **Secret Key** (Private key) - Used in the backend

## Step 3: Add Keys to Environment Variables

### For Local Development:

Update your `.env.local` file:

```bash
# Google reCAPTCHA v3 Configuration
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_site_key_here
RECAPTCHA_SECRET_KEY=your_secret_key_here
```

### For Vercel Production:

1. Go to your Vercel dashboard
2. Select your `co-term-calc` project
3. Go to **Settings** → **Environment Variables**
4. Add these two variables:
   - **Variable name**: `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
     - **Value**: Your site key from Google
     - **Environments**: Production, Preview, Development
   - **Variable name**: `RECAPTCHA_SECRET_KEY`
     - **Value**: Your secret key from Google
     - **Environments**: Production, Preview, Development
5. Click **Save** for each variable
6. Redeploy your application for the changes to take effect

## Step 4: Test the Implementation

1. Navigate to your site (co-term.com)
2. Click "Login / Sign Up"
3. Switch to "Sign Up" mode
4. You should see a small "Protected by reCAPTCHA" badge with a shield icon
5. Try to sign up - the reCAPTCHA will run invisibly in the background
6. If the score is too low (< 0.5), you'll see an error message

## How It Works

- **reCAPTCHA v3 is invisible** - users don't see any challenges or checkboxes
- When a user signs up, the system:
  1. Executes reCAPTCHA in the background
  2. Sends the token to your server
  3. Your server verifies the token with Google
  4. Google returns a score (0.0 = likely bot, 1.0 = likely human)
  5. If the score is below 0.5, the sign-up is blocked
- **Sign-in is not protected** - only sign-ups require reCAPTCHA verification

## Adjusting the Security Threshold

The current threshold is set to **0.5**. You can adjust this in:

File: `components/auth-modal.tsx`

```typescript
// Score should be above 0.5 (0.0 = bot, 1.0 = human)
if (verifyResult.score < 0.5) {
  throw new Error('Security check failed...');
}
```

**Recommended thresholds:**
- **0.3-0.4**: More permissive (fewer false positives, but may let some bots through)
- **0.5**: Balanced (recommended starting point)
- **0.7-0.8**: Strict (better security, but may have false positives)

## Monitoring reCAPTCHA

You can monitor reCAPTCHA activity in the [reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin):
- View request statistics
- See score distributions
- Monitor for suspicious activity

## Troubleshooting

**"reCAPTCHA site key not configured" warning in console:**
- Add the `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` environment variable

**Sign-ups work without reCAPTCHA:**
- This is intentional if the keys aren't configured
- Add the environment variables to enable protection

**"Security check failed" for legitimate users:**
- Lower the threshold score in `auth-modal.tsx`
- Check if your domain is properly registered in the reCAPTCHA console

## Resources

- [reCAPTCHA v3 Documentation](https://developers.google.com/recaptcha/docs/v3)
- [reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
- [Interpreting the Score](https://developers.google.com/recaptcha/docs/v3#interpreting_the_score)
