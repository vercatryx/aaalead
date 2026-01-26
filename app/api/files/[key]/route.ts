import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

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

export async function GET(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const { key } = params;
    if (!key) {
      return NextResponse.json({ error: 'No key provided' }, { status: 400 });
    }

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: decodeURIComponent(key),
    });

    const response = await r2Client.send(command);
    
    if (!response.Body) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const arrayBuffer = await response.Body.transformToByteArray();
    const buffer = Buffer.from(arrayBuffer);
    
    const contentType = response.ContentType || 'application/octet-stream';
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Download error:', error);
    return NextResponse.json({ error: error.message || 'Failed to download file' }, { status: 500 });
  }
}
