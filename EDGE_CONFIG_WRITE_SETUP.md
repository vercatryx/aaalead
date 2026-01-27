# Edge Config Write Setup

## ✅ What's Been Implemented

Edge Config now supports **write operations** using the Vercel REST API! The app can now:
- ✅ Create documents
- ✅ Add document types
- ✅ Update metadata lists

## 🔧 Required: Vercel API Token

To enable writes, you need to add a **Vercel API Token** to your environment variables.

### Step 1: Get Your Vercel API Token

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your profile → **Settings**
3. Go to **Tokens** section
4. Click **Create Token**
5. Give it a name (e.g., "Lead Reports Edge Config")
6. Set expiration (or leave as "No expiration")
7. Click **Create**
8. **Copy the token** (you won't see it again!)

### Step 2: Add to `.env.local`

Add this line to your `.env.local` file:

```bash
VERCEL_API_TOKEN=your_vercel_api_token_here
```

Or if you prefer to use `NEXT_PUBLIC_*` prefix:

```bash
NEXT_PUBLIC_VERCEL_API_TOKEN=your_vercel_api_token_here
```

### Step 3: Add to Vercel Project Settings

For production deployments, add the token to your Vercel project:

1. Go to your project in Vercel Dashboard
2. **Settings** → **Environment Variables**
3. Add:
   - **Name**: `VERCEL_API_TOKEN`
   - **Value**: Your Vercel API token
   - **Environment**: All (Production, Preview, Development)

## 📝 Current `.env.local` Should Include:

```bash
# Edge Config Connection String
EDGE_CONFIG=https://edge-config.vercel.app/ecfg_zvyiozzbdatnied5yofl70hnz1sh?token=3266dec3-4d7a-4024-a959-862f2d62ca1f

# Vercel API Token (for writes)
VERCEL_API_TOKEN=your_vercel_api_token_here

# R2 Storage (unchanged)
REACT_APP_R2_ENDPOINT=...
REACT_APP_R2_ACCESS_KEY_ID=...
REACT_APP_R2_SECRET_ACCESS_KEY=...
REACT_APP_R2_BUCKET_NAME=...
```

## 🧪 Testing

After adding the token, restart your dev server and try uploading a document. It should now work!

## ⚠️ Note

- The Edge Config connection string token is for **reads** (SDK)
- The Vercel API token is for **writes** (REST API)
- Both are needed for full functionality
