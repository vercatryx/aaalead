# Direct Connection on Vercel

## Overview

The database connection module now supports attempting direct connection (IPv6) on Vercel, with automatic fallback to pooler (IPv4) if direct connection fails.

## How It Works

1. **Local Development (Default)**:
   - Uses direct connection (IPv6) by default - faster and works with IPv6
   - Automatically falls back to pooler if direct connection fails

2. **Vercel Deployment (Default)**:
   - Uses pooler connection (IPv4) by default - required for Vercel
   - Uses **Session Mode (Port 5432)** by default (compatible with prepared statements)
   - Can attempt direct connection if `SUPABASE_USE_DIRECT=true` is set
   - Automatically falls back to pooler if direct connection fails

## Configuration

### To Try Direct Connection on Vercel

Set in your Vercel environment variables:
```
SUPABASE_USE_DIRECT=true
```

The system will:
1. First attempt direct connection (IPv6)
2. If it fails (likely due to IPv6 not being supported), automatically fall back to pooler (IPv4)
3. Log the attempt and fallback for debugging

### To Force Pooler (Skip Direct Attempt)
 
 Set in your Vercel environment variables:
 ```
 SUPABASE_USE_POOLER=true
 ```
 
 This will skip the direct connection attempt and go straight to pooler (Session Mode by default).
 
 ### To Use Transaction Mode (Not Recommended for 'pg')
 
 If you are using a client that doesn't use prepared statements, you can force Transaction Mode:
 ```
 SUPABASE_USE_TRANSACTION_MODE=true
 ```

## Important Notes

⚠️ **Vercel Serverless Functions and IPv6**:
- Vercel serverless functions run on AWS Lambda
- AWS Lambda has **limited IPv6 support** (depends on region and configuration)
- Most Vercel deployments **do not support IPv6** by default
- The direct connection will likely fail on Vercel and fall back to pooler

✅ **Automatic Fallback**:
- If direct connection fails with IPv6-related errors (ENOTFOUND, EAI_AGAIN, ETIMEDOUT, etc.), the system automatically tries pooler
- No manual intervention needed
- The fallback is transparent and logged for debugging

## Testing

To test if direct connection works on your Vercel deployment:

1. Set `SUPABASE_USE_DIRECT=true` in Vercel environment variables
2. Deploy your application
3. Check the logs - you should see:
   - `🔌 Attempting direct connection (IPv6) first...`
   - Either: `✅ Direct connection (IPv6) successful!` (if IPv6 works)
   - Or: `⚠️ Direct connection (IPv6) failed on Vercel - this is expected` followed by `🔄 Falling back to pooler connection (IPv4)...`

## Connection Types

### Direct Connection (IPv6)
- **Format**: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
- **Pros**: Faster, lower latency, more connections allowed
- **Cons**: Requires IPv6 support (may not work on Vercel)

### Pooler Connection (IPv4)
- **Transaction Mode** (port 6543): Better for serverless, no prepared statements
- **Session Mode** (port 5432): Requires prepared statements
- **Pros**: Works everywhere, IPv4 compatible
- **Cons**: Slightly slower, fewer connections per function

## Recommendation

For Vercel deployments:
- **Default behavior** (no env vars): Uses pooler - reliable and works
- **If you want to test IPv6**: Set `SUPABASE_USE_DIRECT=true` - will try direct first, fall back to pooler if needed
- **If you want to skip direct attempt**: Set `SUPABASE_USE_POOLER=true` - goes straight to pooler

The automatic fallback ensures your application will work regardless of IPv6 support.
