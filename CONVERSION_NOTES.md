# Next.js Conversion Notes

This project has been converted from Create React App + Express to Next.js.

## What Changed

### 1. Package.json
- Removed `react-scripts`, `concurrently`, `express`, `cors`, `multer`
- Added `next` and `@types/node`
- Updated scripts to use Next.js commands:
  - `npm run dev` - Starts Next.js dev server
  - `npm run build` - Builds Next.js app
  - `npm run start` - Starts production server

### 2. Project Structure
- Created `app/` directory for Next.js App Router
- Created `app/layout.tsx` - Root layout
- Created `app/page.tsx` - Main page (uses App component)
- Created `app/api/` - All API routes converted from Express
- Created `db/` directory with `database.js` and `models.js`

### 3. API Routes
All Express routes have been converted to Next.js API routes:
- `/api/data` → `app/api/data/route.ts`
- `/api/inspectors` → `app/api/inspectors/route.ts`
- `/api/inspectors/[id]` → `app/api/inspectors/[id]/route.ts`
- `/api/documents/*` → `app/api/documents/*/route.ts`
- `/api/upload` → `app/api/upload/route.ts`
- `/api/files/*` → `app/api/files/*/route.ts`
- And all other routes...

### 4. Database
- Database structure created in `db/database.js`
- Models created in `db/models.js`
- SQLite database file: `lead-reports.db` (already exists)

### 5. Configuration Files
- `next.config.js` - Next.js configuration
- `tsconfig.json` - Updated for Next.js
- `next-env.d.ts` - Next.js TypeScript definitions
- `.gitignore` - Added `.next` directory

### 6. Environment Variables
Update your `.env.local` file to use `NEXT_PUBLIC_` prefix for client-side variables:
- `NEXT_PUBLIC_R2_ENDPOINT` (or keep `REACT_APP_R2_ENDPOINT`)
- `NEXT_PUBLIC_R2_ACCESS_KEY_ID` (or keep `REACT_APP_R2_ACCESS_KEY_ID`)
- `NEXT_PUBLIC_R2_SECRET_ACCESS_KEY` (or keep `REACT_APP_R2_SECRET_ACCESS_KEY`)
- `NEXT_PUBLIC_R2_BUCKET_NAME` (or keep `REACT_APP_R2_BUCKET_NAME`)

The API routes will check both prefixes for backward compatibility.

## What to Do Next

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **The app will be available at:**
   - http://localhost:3000 (Next.js default port)

4. **Old files (can be removed after testing):**
   - `server.js` - No longer needed (API routes are in `app/api/`)
   - `build/` - No longer needed (Next.js uses `.next/`)
   - `public/index.html` - No longer needed (Next.js handles this)

## Notes

- The database (`lead-reports.db`) remains unchanged
- All React components remain in `src/` directory
- Templates in `public/templates/` are automatically served by Next.js
- File uploads now use Next.js FormData API instead of multer

## Troubleshooting

If you encounter issues:
1. Make sure all dependencies are installed: `npm install`
2. Check that environment variables are set correctly
3. Verify the database file exists and is accessible
4. Check the Next.js console for any errors
