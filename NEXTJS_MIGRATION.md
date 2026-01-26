# Next.js Migration Complete

This project has been successfully migrated from Create React App + Express to Next.js.

## What Changed

### Architecture
- **Before**: Separate Express server (port 3001) + React dev server (port 3000)
- **After**: Unified Next.js application with integrated API routes

### Key Changes

1. **API Routes**: All Express routes have been converted to Next.js API routes in `app/api/`
2. **Frontend**: React app now runs as a Next.js page in `app/page.tsx`
3. **Configuration**: 
   - `next.config.js` - Next.js configuration
   - `tsconfig.json` - Updated for Next.js
   - `package.json` - Updated scripts and dependencies

### File Structure

```
app/
  ├── api/              # API routes (converted from Express)
  │   ├── data/
  │   ├── documents/
  │   ├── inspectors/
  │   ├── upload/
  │   └── ...
  ├── globals.css       # Global styles
  ├── layout.tsx        # Root layout
  └── page.tsx         # Main page (uses src/App.tsx)

src/                    # React components (unchanged)
public/                 # Static files (templates, etc.)
```

## Running the Project

### Development
```bash
npm install
npm run dev
```

The app will be available at `http://localhost:3000`

### Production
```bash
npm run build
npm start
```

## Environment Variables

Update your `.env.local` file to use Next.js environment variable prefixes:

```env
# R2 Storage Configuration
NEXT_PUBLIC_R2_ENDPOINT=your-endpoint
NEXT_PUBLIC_R2_ACCESS_KEY_ID=your-key
NEXT_PUBLIC_R2_SECRET_ACCESS_KEY=your-secret
NEXT_PUBLIC_R2_BUCKET_NAME=lead-main

# Or keep using REACT_APP_ prefix (backward compatible)
REACT_APP_R2_ENDPOINT=your-endpoint
REACT_APP_R2_ACCESS_KEY_ID=your-key
REACT_APP_R2_SECRET_ACCESS_KEY=your-secret
REACT_APP_R2_BUCKET_NAME=lead-main
```

## API Routes

All API routes are now at `/api/*` and work the same way as before:
- `/api/inspectors` - Inspector management
- `/api/documents` - Document management
- `/api/upload` - File uploads to R2
- `/api/flatten-pdf` - PDF flattening
- And more...

## Benefits

1. **Unified Server**: Frontend and backend run together
2. **Better Performance**: Next.js optimizations
3. **Simpler Development**: No need to manage two servers
4. **Type Safety**: Better TypeScript integration
5. **Modern Stack**: Using latest Next.js features

## Notes

- The old `server.js` file is no longer needed but kept for reference
- Templates in `public/templates/` are automatically served at `/templates/`
- All existing functionality should work the same way
