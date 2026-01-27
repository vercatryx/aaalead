# ✅ Edge Config Setup - What's Done vs What You Need to Do

## ✅ Already Completed (Automated)

1. ✅ **Package installed** - `@vercel/edge-config` added to `package.json`
2. ✅ **Edge Config integration** - All API routes updated to use Edge Config first, then fallback to SQLite
3. ✅ **Storage adapters created** - `lib/edgeConfig.ts` and `lib/edgeConfigStorage.ts`
4. ✅ **Migration script created** - `scripts/migrateToEdgeConfig.ts` to export SQLite data
5. ✅ **All API routes updated** - `/api/data`, `/api/inspectors`, `/api/general-variables`, etc.

## 📋 What You Need to Do (Manual Steps)

### Step 1: Install Dependencies

```bash
npm install
```

This installs `@vercel/edge-config`.

### Step 2: Add Environment Variable to Vercel

1. Go to **Vercel Dashboard** → **Your Project** → **Settings** → **Environment Variables**
2. Click **"Add New"**
3. Enter:
   - **Key**: `EDGE_CONFIG`
   - **Value**: `https://edge-config.vercel.app/ecfg_zvyiozzbdatnied5yofl70hnz1sh?token=3266dec3-4d7a-4024-a959-862f2d62ca1f`
   - **Environment**: Select all (Production, Preview, Development)
4. Click **Save**

### Step 3: For Local Development (Optional)

Create `.env.local` file:

```bash
EDGE_CONFIG=https://edge-config.vercel.app/ecfg_zvyiozzbdatnied5yofl70hnz1sh?token=3266dec3-4d7a-4024-a959-862f2d62ca1f
```

### Step 4: Populate Edge Config with Data

You have 3 options:

#### Option A: Vercel Dashboard (Easiest - Recommended for Testing)

1. Go to **Vercel Dashboard** → **Your Project** → **Storage** → **Edge Config**
2. Click on your Edge Config (`aaalead-token`)
3. Click **"Add Item"** or use the JSON editor
4. Add test data manually (see data structure below)

#### Option B: Migrate from SQLite (If you have existing data)

1. Run the migration script:
   ```bash
   npx tsx scripts/migrateToEdgeConfig.ts > edge-config-data.json
   ```

2. Get your Vercel API token:
   - Go to Vercel Dashboard → Settings → Tokens
   - Create a new token

3. Upload to Edge Config:
   ```bash
   curl -X PATCH "https://api.vercel.com/v1/edge-config/ecfg_zvyiozzbdatnied5yofl70hnz1sh/items" \
     -H "Authorization: Bearer YOUR_VERCEL_TOKEN" \
     -H "Content-Type: application/json" \
     -d @edge-config-data.json
   ```

#### Option C: Use Vercel API Directly

```bash
curl -X PATCH "https://api.vercel.com/v1/edge-config/ecfg_zvyiozzbdatnied5yofl70hnz1sh/items" \
  -H "Authorization: Bearer YOUR_VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "key": "__metadata:inspectors",
        "value": ["inspector-1"]
      },
      {
        "key": "inspectors:inspector-1",
        "value": {"id": "inspector-1", "name": "Test Inspector"}
      }
    ]
  }'
```

### Step 5: Test It

1. Deploy to Vercel (or run locally with `.env.local`)
2. Test the API:
   ```bash
   curl https://your-app.vercel.app/api/data
   ```
3. You should see data from Edge Config if configured, or empty arrays if not

## 📊 Data Structure Reference

For reference, here's the data structure Edge Config expects:

```json
{
  "__metadata:inspectors": ["inspector-1", "inspector-2"],
  "inspectors:inspector-1": {"id": "inspector-1", "name": "John Doe"},
  "inspectors:inspector-2": {"id": "inspector-2", "name": "Jane Smith"},
  "__metadata:inspector_variables:inspector-1": ["var1", "var2"],
  "inspector_variables:inspector-1:var1": "value1",
  "inspector_variable_names": ["var1", "var2"],
  "__metadata:general_variables": ["genVar1"],
  "general_variables:genVar1": "value",
  "__metadata:documents:general-typed": ["doc-1"],
  "documents:doc-1": {
    "id": "doc-1",
    "file_name": "test.pdf",
    "file_path": "documents/doc-1/test.pdf",
    "uploaded_at": "2024-01-01T00:00:00Z",
    "category": "general-typed",
    "document_type": "type1",
    "inspector_id": null
  }
}
```

## ⚠️ Important Notes

1. **Edge Config is READ-ONLY via SDK** - You can't write from your app code
2. **Size Limits**: 8KB per item, 8MB total
3. **Automatic Fallback**: If Edge Config is empty, the app uses SQLite (for local dev)

## ✅ Verification Checklist

- [ ] `npm install` completed
- [ ] `EDGE_CONFIG` environment variable added to Vercel
- [ ] `.env.local` created (for local dev)
- [ ] Test data added to Edge Config
- [ ] API endpoint tested and returns data

## 🆘 Troubleshooting

**"Edge Config not available"**
- Check `EDGE_CONFIG` environment variable is set correctly
- Verify the connection URL format

**"Empty data returned"**
- Add data to Edge Config via Dashboard or API
- Check that metadata keys (`__metadata:*`) are set

**"Build errors"**
- Make sure `npm install` completed successfully
- Check that environment variable is set before build

---

That's it! The code is ready. You just need to:
1. Install dependencies (`npm install`)
2. Add the environment variable to Vercel
3. Populate Edge Config with data

Everything else is automated! 🚀
