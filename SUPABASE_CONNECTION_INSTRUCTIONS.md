# Supabase Connection Setup Instructions

## Current Issue
The hostname `db.hxsjkzatrfefeojvaitn.supabase.co` cannot be resolved by Node.js, even though the connection details appear correct.

## How to Get the Correct Connection String

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Log in and select your project

2. **Navigate to Database Settings**
   - Click on **Settings** in the left sidebar
   - Click on **Database** in the settings menu

3. **Get the Connection String**
   - Scroll down to the **Connection string** section
   - You'll see several options:
     - **URI** - Direct connection (what we're currently using)
     - **Connection pooling** - Transaction mode (recommended for serverless)
     - **Connection pooling** - Session mode

4. **Copy the Connection String**
   - For Next.js API routes using `pg`, use the **Connection pooling → Session mode** connection string (Port 5432)
   - **Do NOT use Transaction mode (Port 6543)** as it doesn't support prepared statements used by `pg`
   - It should look like:
     ```
     postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
     ```
   - OR use the direct URI:
     ```
     postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres
     ```

5. **Check Project Status**
   - Make sure your project is **not paused**
   - If paused, click "Resume" to activate it

6. **Update Your Code**
   - Option A: Set environment variable (recommended)
     - Create/update `.env.local`:
     ```
     DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOSTNAME]:5432/postgres
     ```
   
   - Option B: Update `db/database.js`
     - Replace the connection string on line 16-17

## Common Issues

- **Project Paused**: Supabase free tier projects pause after inactivity
- **Wrong Hostname**: The hostname might have changed
- **Network Issues**: Some networks block database connections
- **IPv6 Only**: Some Supabase instances only have IPv6, which can cause DNS issues

## Test Your Connection

After updating, test with:
```bash
node scripts/test-db-connection.js
```

Or visit: http://localhost:3001/api/test-db-connection
