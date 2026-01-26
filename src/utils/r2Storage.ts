// R2 Configuration
// In Next.js, client-side code can only access NEXT_PUBLIC_* variables
// But we check both for backward compatibility
const R2_ENDPOINT = (typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_R2_ENDPOINT || '')
  : (process.env.REACT_APP_R2_ENDPOINT || process.env.NEXT_PUBLIC_R2_ENDPOINT || ''));
const R2_ACCESS_KEY_ID = (typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_R2_ACCESS_KEY_ID || '')
  : (process.env.REACT_APP_R2_ACCESS_KEY_ID || process.env.NEXT_PUBLIC_R2_ACCESS_KEY_ID || ''));
const R2_SECRET_ACCESS_KEY = (typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_R2_SECRET_ACCESS_KEY || '')
  : (process.env.REACT_APP_R2_SECRET_ACCESS_KEY || process.env.NEXT_PUBLIC_R2_SECRET_ACCESS_KEY || ''));
const R2_BUCKET_NAME = (typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_R2_BUCKET_NAME || 'lead-reports')
  : (process.env.REACT_APP_R2_BUCKET_NAME || process.env.NEXT_PUBLIC_R2_BUCKET_NAME || 'lead-reports'));
// Public R2 domain (for direct file access without CORS)
const R2_PUBLIC_DOMAIN = (typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || 'https://pub-4bdeaebf0c04411e9096fdda492f0706.r2.dev')
  : (process.env.REACT_APP_R2_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || 'https://pub-4bdeaebf0c04411e9096fdda492f0706.r2.dev'));

// Debug: Log environment variables (without exposing secrets)
console.log('🔍 R2 Environment Variables Check:', {
  hasEndpoint: !!R2_ENDPOINT,
  endpointLength: R2_ENDPOINT.length,
  hasAccessKey: !!R2_ACCESS_KEY_ID,
  accessKeyLength: R2_ACCESS_KEY_ID.length,
  hasSecretKey: !!R2_SECRET_ACCESS_KEY,
  secretKeyLength: R2_SECRET_ACCESS_KEY.length,
  hasBucket: !!R2_BUCKET_NAME,
  bucketName: R2_BUCKET_NAME,
  allEnvKeys: Object.keys(process.env).filter(k => k.startsWith('REACT_APP_R2') || k.startsWith('NEXT_PUBLIC_R2'))
});

// Lazy load AWS SDK to avoid breaking if packages aren't installed
let s3Client: any = null;
let sdkLoaded = false;
let sdkLoadError: Error | null = null;

// Lazy initialization function
const ensureSDKLoaded = async () => {
  if (sdkLoaded) return !sdkLoadError;
  if (sdkLoadError) return false;
  
  try {
    const s3Module = await import('@aws-sdk/client-s3');
    const presignerModule = await import('@aws-sdk/s3-request-presigner');
    
    const S3Client = s3Module.S3Client;
    const PutObjectCommand = s3Module.PutObjectCommand;
    const GetObjectCommand = s3Module.GetObjectCommand;
    const DeleteObjectCommand = s3Module.DeleteObjectCommand;
    const getSignedUrl = presignerModule.getSignedUrl;
    
    // Store in module scope
    (globalThis as any).__r2S3Client = S3Client;
    (globalThis as any).__r2PutObjectCommand = PutObjectCommand;
    (globalThis as any).__r2GetObjectCommand = GetObjectCommand;
    (globalThis as any).__r2DeleteObjectCommand = DeleteObjectCommand;
    (globalThis as any).__r2GetSignedUrl = getSignedUrl;
    
    // Initialize client if configured
    if (R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME) {
      s3Client = new S3Client({
        region: 'auto',
        endpoint: R2_ENDPOINT,
        forcePathStyle: true, // Required for R2
        credentials: {
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
      });
      console.log('R2 client initialized successfully', {
        endpoint: R2_ENDPOINT,
        bucket: R2_BUCKET_NAME,
        hasAccessKey: !!R2_ACCESS_KEY_ID,
        hasSecretKey: !!R2_SECRET_ACCESS_KEY
      });
    } else {
      console.warn('R2 client not initialized - missing configuration:', {
        hasEndpoint: !!R2_ENDPOINT,
        hasAccessKey: !!R2_ACCESS_KEY_ID,
        hasSecretKey: !!R2_SECRET_ACCESS_KEY,
        hasBucket: !!R2_BUCKET_NAME
      });
    }
    
    sdkLoaded = true;
    return true;
  } catch (error: any) {
    console.warn('AWS SDK not available. R2 storage will not work. Install with: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner --legacy-peer-deps');
    sdkLoadError = error;
    sdkLoaded = true;
    return false;
  }
};

/**
 * Upload a file to R2 storage
 * @param file The file to upload
 * @param key The unique key/path for the file in R2 (e.g., "documents/doc-id/filename.pdf")
 * @returns The R2 key/path where the file was stored
 */
// Upload via API server to avoid CORS issues
export const uploadFileToR2 = async (file: File | Blob, key: string): Promise<string> => {
  // Use relative URL - proxy will forward to API server
  const API_URL = '/api';
  
  try {
    console.log('📤 Starting R2 upload via API:', {
      key: key,
      fileName: file instanceof File ? file.name : 'Blob',
      fileSize: file.size,
      contentType: file.type || 'application/octet-stream',
      apiUrl: API_URL
    });
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('key', key);

    console.log('📡 Sending upload request to API server...');
    const response = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      
      // If R2 is not configured, show helpful error message
      if (errorData.error === 'R2 storage is not configured' && errorData.missingVars) {
        throw new Error(
          '❌ R2 storage is not configured!\n\n' +
          'Missing environment variables:\n' +
          errorData.missingVars.map((v: string) => `  - ${v}`).join('\n') +
          '\n\n' + (errorData.instructions || '') +
          '\n\n⚠️ IMPORTANT: After adding these, you MUST restart your development server (stop and run npm run dev again).\n' +
          'Environment variables are only loaded when the dev server starts.'
        );
      }
      
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`✅ File uploaded to R2 via API: ${key}`);
    return result.key || key;
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    
    // Check if it's a connection error (API server not running)
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
      throw new Error(
        `Failed to connect to upload API server.\n\n` +
        `Please make sure you started the Next.js app with:\n` +
        `  npm run dev\n\n` +
        `Error: ${errorMessage}`
      );
    }
    
    throw new Error(
      `Failed to upload file to R2: ${errorMessage}\n` +
      `File: ${file instanceof File ? file.name : 'Blob'}\n` +
      `Key: ${key}\n\n` +
      `Please check:\n` +
      `  1. App is running with 'npm run dev'\n` +
      `  2. R2 credentials are configured in .env.local\n` +
      `  3. Network connection is available`
    );
  }
};

/**
 * Get a file from R2 storage directly from Cloudflare R2 endpoint
 * @param key The R2 key/path of the file
 * @returns The file as a Blob
 */
export const getFileFromR2 = async (key: string): Promise<Blob> => {
  try {
    // Use direct R2 endpoint URL
    // Format: https://{account-id}.r2.cloudflarestorage.com/{bucket}/{key}
    const bucket = R2_BUCKET_NAME;
    const r2Url = `${R2_ENDPOINT}/${bucket}/${key}`;
    
    // Also try public domain if available
    const publicUrl = R2_PUBLIC_DOMAIN ? `${R2_PUBLIC_DOMAIN}/${key}` : null;
    
    console.log('📥 Fetching file from R2:', {
      key,
      r2Url,
      publicUrl: publicUrl || 'N/A',
      bucket
    });
    
    // Try public domain first (usually faster), fallback to direct endpoint
    let response: Response | null = null;
    let usedUrl = '';
    
    if (publicUrl) {
      try {
        response = await fetch(publicUrl);
        usedUrl = publicUrl;
        if (response.ok) {
          console.log(`✅ Fetched from public domain: ${publicUrl}`);
        } else {
          console.warn(`⚠️ Public domain returned ${response.status}, trying direct endpoint...`);
          response = null;
        }
      } catch (err) {
        console.warn(`⚠️ Failed to fetch from public domain, trying direct endpoint:`, err);
      }
    }
    
    // Fallback to direct endpoint
    if (!response || !response.ok) {
      response = await fetch(r2Url);
      usedUrl = r2Url;
    }
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file: HTTP ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    const fileSize = blob.size;
    
    console.log('📦 File fetched successfully:', {
      key,
      url: usedUrl,
      size: fileSize,
      sizeFormatted: `${(fileSize / 1024).toFixed(2)} KB`,
      type: blob.type || 'unknown'
    });
    
    // Validate file is not empty
    if (fileSize === 0) {
      throw new Error(`File "${key}" is empty (0 bytes). The file may not have been uploaded correctly or may have been corrupted.`);
    }
    
    // Warn if file is suspiciously small (less than 10 bytes)
    if (fileSize < 10) {
      console.warn(`⚠️ File "${key}" is very small (${fileSize} bytes). This may indicate a problem.`);
    }
    
    return blob;
  } catch (error: any) {
    console.error('❌ Error getting file from R2:', {
      key,
      error: error.message || error,
      r2Url: `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${key}`,
      publicUrl: R2_PUBLIC_DOMAIN ? `${R2_PUBLIC_DOMAIN}/${key}` : 'N/A'
    });
    throw new Error(`Failed to get file from R2: ${error.message || error}`);
  }
};

/**
 * Get a presigned URL for a file (for direct access)
 * @param key The R2 key/path of the file
 * @param expiresIn Expiration time in seconds (default: 1 hour)
 * @returns A presigned URL
 */
export const getPresignedUrl = async (key: string, expiresIn: number = 3600): Promise<string> => {
  const sdkAvailable = await ensureSDKLoaded();
  
  if (!sdkAvailable || !s3Client) {
    throw new Error('R2 client not initialized. Please check your .env configuration.');
  }
  
  try {
    const GetObjectCommand = (globalThis as any).__r2GetObjectCommand;
    const getSignedUrl = (globalThis as any).__r2GetSignedUrl;
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error: any) {
    console.error('Error generating presigned URL:', error);
    throw new Error(`Failed to generate presigned URL: ${error.message || error}`);
  }
};

/**
 * Delete a file from R2 storage
 * @param key The R2 key/path of the file to delete
 */
export const deleteFileFromR2 = async (key: string): Promise<void> => {
  const sdkAvailable = await ensureSDKLoaded();
  
  if (!sdkAvailable || !s3Client) {
    console.warn('R2 not available, skipping file deletion');
    return;
  }
  
  try {
    const DeleteObjectCommand = (globalThis as any).__r2DeleteObjectCommand;
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    console.log(`File deleted from R2: ${key}`);
  } catch (error: any) {
    console.error('Error deleting file from R2:', error);
    // Don't throw - just log the error
  }
};

/**
 * Generate a unique key for a document file
 * @param docId Document ID
 * @param fileName Original file name
 * @returns A unique key for R2 storage
 */
export const generateR2Key = (docId: string, fileName: string): string => {
  // Sanitize filename and create path: documents/{docId}/{sanitized-filename}
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `documents/${docId}/${sanitizedFileName}`;
};

/**
 * Check if R2 is configured
 * In Next.js, client-side can't access server env vars, so we check via API
 */
export const isR2Configured = async (): Promise<boolean> => {
  // If we're on the client side, check via API health endpoint
  if (typeof window !== 'undefined') {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        const data = await response.json();
        return data.r2Configured === true;
      }
    } catch (error) {
      console.warn('Could not check R2 configuration via API:', error);
    }
    return false;
  }
  
  // Server-side: check directly
  const sdkAvailable = await ensureSDKLoaded();
  return !!(
    sdkAvailable &&
    s3Client &&
    R2_ENDPOINT &&
    R2_ACCESS_KEY_ID &&
    R2_SECRET_ACCESS_KEY &&
    R2_BUCKET_NAME
  );
};
