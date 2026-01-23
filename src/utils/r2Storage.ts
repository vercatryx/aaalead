// R2 Configuration
const R2_ENDPOINT = process.env.REACT_APP_R2_ENDPOINT || '';
const R2_ACCESS_KEY_ID = process.env.REACT_APP_R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.REACT_APP_R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.REACT_APP_R2_BUCKET_NAME || 'lead-reports';

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
  allEnvKeys: Object.keys(process.env).filter(k => k.startsWith('REACT_APP_R2'))
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
        `Please make sure you started the app with:\n` +
        `  npm start\n\n` +
        `This will start both the React app and API server together.\n` +
        `Error: ${errorMessage}`
      );
    }
    
    throw new Error(
      `Failed to upload file to R2: ${errorMessage}\n` +
      `File: ${file instanceof File ? file.name : 'Blob'}\n` +
      `Key: ${key}\n\n` +
      `Please check:\n` +
      `  1. App is running with 'npm start' (starts both React and API server)\n` +
      `  2. R2 credentials are configured in .env.local\n` +
      `  3. Network connection is available`
    );
  }
};

/**
 * Get a file from R2 storage
 * @param key The R2 key/path of the file
 * @returns The file as a Blob
 */
export const getFileFromR2 = async (key: string): Promise<Blob> => {
  const sdkAvailable = await ensureSDKLoaded();
  
  if (!sdkAvailable || !s3Client) {
    throw new Error('R2 client not initialized. Please check your .env configuration and ensure AWS SDK is installed.');
  }
  
  try {
    const GetObjectCommand = (globalThis as any).__r2GetObjectCommand;
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);
    
    if (!response.Body) {
      throw new Error(`File not found in R2: ${key}`);
    }

    // Convert stream to array buffer then to blob
    const arrayBuffer = await response.Body.transformToByteArray();
    const contentType = response.ContentType || 'application/octet-stream';
    
    return new Blob([arrayBuffer], { type: contentType });
  } catch (error: any) {
    console.error('Error getting file from R2:', error);
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
 */
export const isR2Configured = async (): Promise<boolean> => {
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
