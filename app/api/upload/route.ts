import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(request: NextRequest) {
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

    await r2Client.send(command);
    
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
