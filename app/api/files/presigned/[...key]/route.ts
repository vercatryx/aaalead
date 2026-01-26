import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
  { params }: { params: { key: string[] } }
) {
  try {
    const key = Array.isArray(params.key) ? params.key.join('/') : params.key;
    if (!key) {
      return NextResponse.json({ error: 'No key provided' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const expiresIn = parseInt(searchParams.get('expiresIn') || '3600');

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: decodeURIComponent(key),
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn });
    
    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Presigned URL error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate presigned URL' }, { status: 500 });
  }
}
