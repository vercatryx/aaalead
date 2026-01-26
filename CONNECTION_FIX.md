# Database Connection Fix - Explanation

## The Problem

The application was failing to connect to Supabase PostgreSQL with the error:
```
getaddrinfo ENOTFOUND db.hxsjkzatrfefeojvaitn.supabase.co
```

## Root Cause

The issue had **two parts**:

### 1. IPv6 vs IPv4 Compatibility
- The **direct Supabase connection** (`db.hxsjkzatrfefeojvaitn.supabase.co`) is **IPv6-only**
- Many networks (including your development environment) only support **IPv4**
- This caused DNS resolution to fail: `getaddrinfo ENOTFOUND`

### 2. Environment Variable Override
- The `.env.local` file contained:
  ```
  DATABASE_URL=postgresql://postgres:LeadClean^467@db.hxsjkzatrfefeojvaitn.supabase.co:5432/postgres
  ```
- This **direct connection string** was overriding the pooler connection string in the code
- Even though the code was updated to use the Session Pooler, the environment variable took precedence

## The Solution

### Updated `.env.local`
Changed from direct connection (IPv6-only) to Session Pooler (IPv4 compatible):

**Before:**
```
DATABASE_URL=postgresql://postgres:LeadClean^467@db.hxsjkzatrfefeojvaitn.supabase.co:5432/postgres
```

**After:**
```
DATABASE_URL=postgresql://postgres.hxsjkzatrfefeojvaitn:LeadClean%5E467@aws-0-us-west-2.pooler.supabase.com:5432/postgres
```

### Key Differences:
1. **Hostname**: `db.hxsjkzatrfefeojvaitn.supabase.co` → `aws-0-us-west-2.pooler.supabase.com`
2. **Username format**: `postgres` → `postgres.hxsjkzatrfefeojvaitn` (project-specific)
3. **Password encoding**: `^` → `%5E` (URL-encoded)
4. **Region**: `us-west-2` (verified working region)

## Why Session Pooler Works

The Supabase **Session Pooler**:
- ✅ Supports **IPv4 networks** (works everywhere)
- ✅ Supports **prepared statements** (required for `pg` module)
- ✅ Provides **connection pooling** (better performance)
- ✅ Uses port **5432** (same as direct connection)

## Verification

You can verify the connection is working by:

1. **Check diagnostic endpoint:**
   ```bash
   curl http://localhost:3001/api/db-diagnostic
   ```
   Should show: `"isPooler": true, "isDirect": false`

2. **Test API calls:**
   ```bash
   curl http://localhost:3001/api/document-types/general
   ```
   Should return `[]` (empty array) or data, not an error

## Important Notes

- **Restart Next.js dev server** after changing `.env.local` to pick up new environment variables
- The password in the connection string must be **URL-encoded** (`^` = `%5E`)
- If connection fails, check the region: `us-west-2` is verified working for this project
- The pooler connection string format: `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres`

## Next Steps

1. ✅ Connection is now working
2. Make sure tables are created in Supabase (run `db/schema.sql` in Supabase SQL Editor)
3. Test all API endpoints to ensure they work correctly
