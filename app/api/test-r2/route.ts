import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.NEXT_PUBLIC_R2_ENDPOINT || process.env.REACT_APP_R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_R2_ACCESS_KEY_ID || process.env.REACT_APP_R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.NEXT_PUBLIC_R2_SECRET_ACCESS_KEY || process.env.REACT_APP_R2_SECRET_ACCESS_KEY || '',
  },
});

const R2_BUCKET_NAME = process.env.NEXT_PUBLIC_R2_BUCKET_NAME || process.env.REACT_APP_R2_BUCKET_NAME || 'lead-main';

export async function GET() {
  try {
    const testKey = `test/connection-test-${Date.now()}.txt`;
    const testContent = 'R2 connection test';
    
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: testKey,
      Body: Buffer.from(testContent),
      ContentType: 'text/plain',
    });

    await r2Client.send(command);
    return NextResponse.json({ 
      success: true, 
      message: 'R2 connection successful',
      testKey 
    });
  } catch (error: any) {
    console.error('R2 test error:', error);
    return NextResponse.json({ 
      error: 'R2 connection failed',
      message: error.message,
      details: error.toString(),
      config: {
        hasEndpoint: !!(process.env.NEXT_PUBLIC_R2_ENDPOINT || process.env.REACT_APP_R2_ENDPOINT),
        hasAccessKey: !!(process.env.NEXT_PUBLIC_R2_ACCESS_KEY_ID || process.env.REACT_APP_R2_ACCESS_KEY_ID),
        hasSecretKey: !!(process.env.NEXT_PUBLIC_R2_SECRET_ACCESS_KEY || process.env.REACT_APP_R2_SECRET_ACCESS_KEY),
        bucket: R2_BUCKET_NAME,
        endpoint: process.env.NEXT_PUBLIC_R2_ENDPOINT || process.env.REACT_APP_R2_ENDPOINT
      }
    }, { status: 500 });
  }
}
