# Environment Variables Setup

## ⚠️ IMPORTANT: Security

**Never commit your `.env.local` file to git!** It contains sensitive credentials.

## Quick Setup

1. Copy the example file:
   ```bash
   cp ENV.example .env.local
   ```

2. Edit `.env.local` and fill in your actual credentials:
   ```bash
   # Supabase Database
   SUPABASE_PROJECT_REF=your-actual-project-ref
   SUPABASE_DB_PASSWORD=your-actual-password
   
   # R2 Storage (Cloudflare)
   NEXT_PUBLIC_R2_ENDPOINT=your-actual-endpoint
   NEXT_PUBLIC_R2_ACCESS_KEY_ID=your-actual-key-id
   NEXT_PUBLIC_R2_SECRET_ACCESS_KEY=your-actual-secret-key
   NEXT_PUBLIC_R2_BUCKET_NAME=your-actual-bucket-name
   ```

3. Restart your dev server:
   ```bash
   npm run dev
   ```

## Rotating Credentials

If your credentials were exposed in git:

1. **Supabase Database Password:**
   - Go to your Supabase project dashboard
   - Navigate to Settings → Database
   - Click "Reset Database Password"
   - Update `SUPABASE_DB_PASSWORD` in your `.env.local`

2. **R2 Storage Credentials:**
   - Go to Cloudflare Dashboard → R2
   - Create new API tokens or rotate existing ones
   - Update the R2 variables in your `.env.local`

## Environment Variables Reference

### Supabase Database

- `DATABASE_URL` (optional): Full connection string. If set, other Supabase vars are ignored.
- `SUPABASE_PROJECT_REF`: Your Supabase project reference ID
- `SUPABASE_DB_PASSWORD`: Your Supabase database password
- `SUPABASE_USE_POOLER` (optional): Set to `true` to use pooler instead of direct connection (default: `false` - uses direct connection which is faster)
- `SUPABASE_POOLER_REGION`: Region for pooler (default: `us-west-2`, only needed if using pooler)

**Note:** The app now defaults to **direct connection** which is faster and more reliable. The pooler is only used if you explicitly set `SUPABASE_USE_POOLER=true`. Direct connection requires IPv6 support.

### R2 Storage (Cloudflare)

- `NEXT_PUBLIC_R2_ENDPOINT`: R2 endpoint URL
- `NEXT_PUBLIC_R2_ACCESS_KEY_ID`: R2 access key ID
- `NEXT_PUBLIC_R2_SECRET_ACCESS_KEY`: R2 secret access key
- `NEXT_PUBLIC_R2_BUCKET_NAME`: R2 bucket name
- `NEXT_PUBLIC_R2_PUBLIC_DOMAIN`: Public R2 domain (optional)

### Legacy Variables (for backward compatibility)

If you have existing `REACT_APP_*` variables, they will still work but `NEXT_PUBLIC_*` is preferred.

## Verification

After setting up your `.env.local`, verify it's working:

1. Check that the app starts without errors
2. Try uploading a document to verify R2 is configured
3. Check the database connection in the app

## Troubleshooting

- **"Missing required Supabase credentials"**: Make sure `.env.local` exists and has the required variables
- **"Database connection failed"**: Verify your Supabase credentials are correct
- **"R2 upload failed"**: Check your R2 credentials and bucket name
