import { NextResponse } from 'next/server';

const R2_BUCKET_NAME = process.env.NEXT_PUBLIC_R2_BUCKET_NAME || process.env.REACT_APP_R2_BUCKET_NAME || 'lead-main';

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    r2Configured: !!(
      (process.env.NEXT_PUBLIC_R2_ENDPOINT || process.env.REACT_APP_R2_ENDPOINT) &&
      (process.env.NEXT_PUBLIC_R2_ACCESS_KEY_ID || process.env.REACT_APP_R2_ACCESS_KEY_ID) &&
      (process.env.NEXT_PUBLIC_R2_SECRET_ACCESS_KEY || process.env.REACT_APP_R2_SECRET_ACCESS_KEY) &&
      R2_BUCKET_NAME
    )
  });
}
