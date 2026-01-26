import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Get R2 configuration (check both NEXT_PUBLIC_* and REACT_APP_* for backward compatibility)
const R2_ENDPOINT = process.env.NEXT_PUBLIC_R2_ENDPOINT || process.env.REACT_APP_R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.NEXT_PUBLIC_R2_ACCESS_KEY_ID || process.env.REACT_APP_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.NEXT_PUBLIC_R2_SECRET_ACCESS_KEY || process.env.REACT_APP_R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.NEXT_PUBLIC_R2_BUCKET_NAME || process.env.REACT_APP_R2_BUCKET_NAME || 'lead-main';

// Check if R2 is configured
const isR2Configured = () => {
  return !!(R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);
};

// Initialize R2 client only if configured
let r2Client: S3Client | null = null;
if (isR2Configured()) {
  r2Client = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT!,
    forcePathStyle: true,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function POST(request: NextRequest) {
  // Check if R2 is configured
  if (!isR2Configured() || !r2Client) {
    const missingVars: string[] = [];
    if (!R2_ENDPOINT) missingVars.push('REACT_APP_R2_ENDPOINT or NEXT_PUBLIC_R2_ENDPOINT');
    if (!R2_ACCESS_KEY_ID) missingVars.push('REACT_APP_R2_ACCESS_KEY_ID or NEXT_PUBLIC_R2_ACCESS_KEY_ID');
    if (!R2_SECRET_ACCESS_KEY) missingVars.push('REACT_APP_R2_SECRET_ACCESS_KEY or NEXT_PUBLIC_R2_SECRET_ACCESS_KEY');
    if (!R2_BUCKET_NAME) missingVars.push('REACT_APP_R2_BUCKET_NAME or NEXT_PUBLIC_R2_BUCKET_NAME');

    return NextResponse.json({ 
      error: 'R2 storage is not configured',
      message: 'Missing environment variables',
      missingVars,
      instructions: 'Add these to your .env.local file and restart the dev server:\n' +
        '  REACT_APP_R2_ENDPOINT=your-r2-endpoint\n' +
        '  REACT_APP_R2_ACCESS_KEY_ID=your-access-key\n' +
        '  REACT_APP_R2_SECRET_ACCESS_KEY=your-secret-key\n' +
        '  REACT_APP_R2_BUCKET_NAME=your-bucket-name'
    }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const key = formData.get('key') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!key) {
      return NextResponse.json({ error: 'No key provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type || 'application/octet-stream',
    });

    await r2Client!.send(command);
    
    return NextResponse.json({ success: true, key });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: 'Upload failed',
      message: error.message,
      details: error.toString()
    }, { status: 500 });
  }
}
