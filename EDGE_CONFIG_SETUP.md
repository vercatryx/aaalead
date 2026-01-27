# Vercel Edge Config Setup - Complete Guide

## ✅ Your Edge Config Details

- **Edge Config ID**: `ecfg_zvyiozzbdatnied5yofl70hnz1sh`
- **Token Label**: `aaalead-token`
- **Token Key**: `3266dec3-4d7a-4024-a959-862f2d62ca1f`
- **Digest**: `5bf6b008a9ec05f6870c476d10b53211797aa000f95aae344ae60f9b422286da`

## 🔧 Step 1: Install Package

The package is already added to `package.json`. Run:

```bash
npm install
```

This will install `@vercel/edge-config`.

## 🔧 Step 2: Add Environment Variable to Vercel

Go to **Vercel Dashboard** → **Your Project** → **Settings** → **Environment Variables**

Add this environment variable:

**Variable Name:**
```
EDGE_CONFIG
```

**Value:**
```
https://edge-config.vercel.app/ecfg_zvyiozzbdatnied5yofl70hnz1sh?token=3266dec3-4d7a-4024-a959-862f2d62ca1f
```

**Environment:** Select all (Production, Preview, Development)

Click **Save**.

## 🔧 Step 3: For Local Development

Add to your `.env.local` file:

```bash
EDGE_CONFIG=https://edge-config.vercel.app/ecfg_zvyiozzbdatnied5yofl70hnz1sh?token=3266dec3-4d7a-4024-a959-862f2d62ca1f
```

## 📊 Step 4: Populate Edge Config with Data

Edge Config is **read-only via the SDK**. To add data, you have 3 options:

### Option A: Vercel Dashboard (Easiest)

1. Go to **Vercel Dashboard** → **Your Project** → **Storage** → **Edge Config**
2. Click on your Edge Config (`aaalead-token`)
3. Click **"Add Item"** or **"Edit"**
4. Add key-value pairs (see data structure below)

### Option B: Vercel API

Use the Vercel API to bulk upload data:

```bash
curl -X PATCH "https://api.vercel.com/v1/edge-config/ecfg_zvyiozzbdatnied5yofl70hnz1sh/items" \
  -H "Authorization: Bearer YOUR_VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "key": "__metadata:inspectors",
        "value": ["inspector-1", "inspector-2"]
      },
      {
        "key": "inspectors:inspector-1",
        "value": {
          "id": "inspector-1",
          "name": "John Doe"
        }
      }
    ]
  }'
```

### Option C: Edge Config API Directly

```bash
curl -X PATCH "https://api.vercel.com/v1/edge-config/ecfg_zvyiozzbdatnied5yofl70hnz1sh/items" \
  -H "Authorization: Bearer 3266dec3-4d7a-4024-a959-862f2d62ca1f" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "key": "inspectors:inspector-1",
        "value": {"id": "inspector-1", "name": "John Doe"}
      }
    ]
  }'
```

## 📋 Data Structure Required

Your Edge Config needs these keys:

### Inspectors
```
__metadata:inspectors → ["inspector-id-1", "inspector-id-2", ...]
inspectors:inspector-id-1 → {"id": "inspector-id-1", "name": "Inspector Name"}
inspectors:inspector-id-2 → {"id": "inspector-id-2", "name": "Another Inspector"}
```

### Inspector Variables
```
__metadata:inspector_variables:inspector-id-1 → ["variable1", "variable2"]
inspector_variables:inspector-id-1:variable1 → "value1"
inspector_variables:inspector-id-1:variable2 → "value2"
```

### Inspector Variable Names (Global)
```
inspector_variable_names → ["variable1", "variable2", "variable3"]
```

### Document Types
```
__metadata:document_types:category-name → ["type1", "type2"]
document_types:type1 → "category-name"
document_types:type2 → "category-name"
```

### General Variables
```
__metadata:general_variables → ["var1", "var2"]
general_variables:var1 → "value1"
general_variables:var2 → "value2"
```

### Documents
```
__metadata:documents:general-typed → ["doc-id-1", "doc-id-2"]
__metadata:documents:inspector → ["doc-id-3", "doc-id-4"]
documents:doc-id-1 → {
  "id": "doc-id-1",
  "file_name": "document.pdf",
  "file_path": "documents/doc-id-1/document.pdf",
  "uploaded_at": "2024-01-01T00:00:00Z",
  "category": "general-typed",
  "document_type": "type1",
  "inspector_id": null
}
documents:doc-id-3 → {
  "id": "doc-id-3",
  "file_name": "inspector-doc.pdf",
  "file_path": "documents/doc-id-3/inspector-doc.pdf",
  "uploaded_at": "2024-01-01T00:00:00Z",
  "category": "inspector",
  "document_type": "type1",
  "inspector_id": "inspector-id-1"
}
```

## 🚀 How It Works

1. **Priority**: Edge Config → SQLite Database (fallback)
2. **API Routes**: All routes check Edge Config first
3. **Automatic Fallback**: If Edge Config is empty/unavailable, uses SQLite

## ⚠️ Important Limitations

### Edge Config is READ-ONLY via SDK

The `@vercel/edge-config` SDK only supports **reading** data. To write/update:

- ✅ Use Vercel Dashboard (manual)
- ✅ Use Vercel API (programmatic)
- ❌ Cannot write from your Next.js app code

### Size Limits

- **8KB per item** - Each key-value pair
- **8MB total** - Total size of all items
- **128KB per request** - Response size limit

### For Write Operations

If you need to write data from your app, consider:

1. **Vercel KV** (Redis) - Fast key-value with read/write
2. **Vercel Postgres** - Full SQL database
3. **Supabase** - PostgreSQL with real-time

## 🧪 Testing

1. **Set environment variable** (see Step 2 or 3)
2. **Add some test data** to Edge Config (see Step 4)
3. **Run the app**:
   ```bash
   npm run dev
   ```
4. **Test API endpoint**:
   ```bash
   curl http://localhost:3000/api/data
   ```

You should see data from Edge Config if configured, or empty arrays if not.

## 📝 Migration Script (Optional)

To migrate existing SQLite data to Edge Config, you would need to:

1. Export data from SQLite
2. Transform to Edge Config format
3. Use Vercel API to upload

Example structure:
```typescript
// scripts/migrateToEdgeConfig.ts
import { getAllData } from '../db/models.js';

async function migrate() {
  const data = getAllData();
  
  const items = [
    {
      key: '__metadata:inspectors',
      value: data.inspectors.map(i => i.id)
    },
    ...data.inspectors.map(inspector => ({
      key: `inspectors:${inspector.id}`,
      value: { id: inspector.id, name: inspector.name }
    }))
    // ... more items
  ];
  
  // Upload via Vercel API
  // ...
}
```

## ✅ Verification Checklist

- [ ] `@vercel/edge-config` installed (`npm install`)
- [ ] `EDGE_CONFIG` environment variable set in Vercel
- [ ] `EDGE_CONFIG` added to `.env.local` for local dev
- [ ] Test data added to Edge Config
- [ ] API endpoint `/api/data` returns Edge Config data
- [ ] App works with Edge Config on Vercel

## 🆘 Troubleshooting

### "Edge Config not available"
- Check `EDGE_CONFIG` environment variable is set
- Verify the connection URL format is correct
- Make sure token is valid

### "Empty data returned"
- Add data to Edge Config via Dashboard or API
- Check that metadata keys (`__metadata:*`) are set
- Verify key naming matches expected format

### "Build errors"
- Make sure `@vercel/edge-config` is installed
- Check that environment variable is set before build
- Verify Edge Config ID and token are correct
