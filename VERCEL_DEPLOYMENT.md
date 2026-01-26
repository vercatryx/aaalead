# Vercel Deployment Guide

## ✅ Build Status
The application is now configured to build and deploy to Vercel **without the database**.

## Key Changes Made

### 1. Database Made Optional
- `better-sqlite3` is now handled gracefully when not available
- All database functions return empty arrays/maps when DB is unavailable
- API routes return appropriate 503 errors when database is not available
- Database features are disabled on Vercel (expected behavior)

### 2. Configuration Updates
- Removed `output: 'standalone'` from `next.config.js` (that's for Docker, not Vercel)
- Fixed Turbopack configuration warnings
- Made puppeteer import optional in flatten-pdf route

### 3. Files Created
- `vercel.json` - Vercel deployment configuration
- `.vercelignore` - Files to exclude from deployment

## Deployment Steps

### 1. Push to GitHub/GitLab/Bitbucket
```bash
git add .
git commit -m "Configure for Vercel deployment"
git push
```

### 2. Deploy to Vercel

**Option A: Via Vercel Dashboard**
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your repository
4. Vercel will auto-detect Next.js
5. Add environment variables (see below)
6. Click "Deploy"

**Option B: Via Vercel CLI**
```bash
npm i -g vercel
vercel
```

### 3. Environment Variables

Add these in Vercel Dashboard → Project Settings → Environment Variables:

**Required for R2 Storage:**
```
REACT_APP_R2_ENDPOINT=your-r2-endpoint
REACT_APP_R2_ACCESS_KEY_ID=your-access-key
REACT_APP_R2_SECRET_ACCESS_KEY=your-secret-key
REACT_APP_R2_BUCKET_NAME=your-bucket-name
```

**Optional (for R2 public domain):**
```
REACT_APP_R2_PUBLIC_DOMAIN=your-public-domain
```

**Note:** You can also use `NEXT_PUBLIC_*` prefix instead of `REACT_APP_*` for client-side variables.

## What Works on Vercel

✅ **Frontend** - Full React app  
✅ **API Routes** - All API routes work  
✅ **R2 Storage** - File upload/download works  
✅ **PDF Generation** - PDF creation works  
✅ **Static Assets** - Templates and public files  

❌ **Database Features** - Disabled (expected - better-sqlite3 doesn't work on Vercel)

## Database Alternative

If you need database functionality on Vercel, consider:
- **Vercel Postgres** - Serverless PostgreSQL
- **PlanetScale** - Serverless MySQL
- **Supabase** - PostgreSQL with real-time features
- **MongoDB Atlas** - Serverless MongoDB

## Build Verification

To verify the build works locally:
```bash
npm run build
npm run start
```

The build should complete successfully without errors.

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Ensure no native modules are required (except better-sqlite3 which is optional)
- Check `next.config.js` for any invalid configurations

### R2 Upload Fails
- Verify environment variables are set in Vercel
- Check that R2 credentials are correct
- Ensure bucket name matches

### Database Errors
- Database is intentionally disabled on Vercel
- API routes will return 503 errors for database operations
- This is expected behavior

## Notes

- The database (`lead-reports.db`) is not deployed to Vercel
- Database features are gracefully disabled when better-sqlite3 is unavailable
- All other features work normally on Vercel
