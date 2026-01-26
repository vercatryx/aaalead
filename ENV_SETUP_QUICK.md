# Quick Environment Setup Guide

## What You Need

### 1. Supabase Database Credentials

**SUPABASE_PROJECT_REF** (✅ Already found):
```
SUPABASE_PROJECT_REF=hxsjkzatrfefeojvaitn
```

**SUPABASE_DB_PASSWORD** (You need to get this):
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **Database**
4. Scroll down to **Database Password**
5. If you don't know it, click **Reset Database Password**
6. Copy the password and use it in your `.env.local`

### 2. R2 Storage Credentials (Cloudflare)

You need these if you want to upload/store documents:
- `NEXT_PUBLIC_R2_ENDPOINT` - Your R2 endpoint URL
- `NEXT_PUBLIC_R2_ACCESS_KEY_ID` - R2 access key ID
- `NEXT_PUBLIC_R2_SECRET_ACCESS_KEY` - R2 secret access key
- `NEXT_PUBLIC_R2_BUCKET_NAME` - Your R2 bucket name
- `NEXT_PUBLIC_R2_PUBLIC_DOMAIN` - Public R2 domain (optional)

Get these from: Cloudflare Dashboard → R2 → Manage R2 API Tokens

## Minimum Required Setup

For the app to work with the database, you **MUST** have at minimum:

```env
SUPABASE_PROJECT_REF=hxsjkzatrfefeojvaitn
SUPABASE_DB_PASSWORD=your-actual-password-here
```

R2 credentials are **optional** - the app will work without them, but you won't be able to upload documents.

## Quick Start

1. Copy the example file:
   ```bash
   cp ENV.example .env.local
   ```

2. Edit `.env.local` and add your actual database password:
   ```env
   SUPABASE_PROJECT_REF=hxsjkzatrfefeojvaitn
   SUPABASE_DB_PASSWORD=your-actual-password-here
   ```

3. (Optional) Add R2 credentials if you have them

4. Restart your dev server:
   ```bash
   npm run dev
   ```

## Verify It Works

After restarting, check:
- Visit `http://localhost:3001/api/db-diagnostic` to see connection status
- Check server logs for: `✅ Database connection test successful`
