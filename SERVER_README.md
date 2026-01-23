# R2 Upload API Server

This server handles R2 uploads to avoid CORS issues when uploading from the browser.

## Setup

1. **Install dependencies** (already done):
   ```bash
   npm install
   ```

2. **Start the API server**:
   ```bash
   npm run server
   ```
   
   The server will run on `http://localhost:3001`

3. **Start the React app** (in a separate terminal):
   ```bash
   npm start
   ```

## API Endpoints

### Health Check
```
GET /api/health
```
Returns server status and R2 configuration status.

### Test R2 Connection
```
GET /api/test-r2
```
Tests the R2 connection by uploading a test file.

### Upload File
```
POST /api/upload
Content-Type: multipart/form-data

Body:
  - file: The file to upload
  - key: The R2 key/path for the file
```

## Environment Variables

The server reads from `.env.local`:
- `REACT_APP_R2_ENDPOINT`
- `REACT_APP_R2_ACCESS_KEY_ID`
- `REACT_APP_R2_SECRET_ACCESS_KEY`
- `REACT_APP_R2_BUCKET_NAME`

## Notes

- The server must be running for file uploads to work
- The React app will automatically use the API server at `http://localhost:3001`
- To change the API URL, set `REACT_APP_API_URL` in `.env.local`
