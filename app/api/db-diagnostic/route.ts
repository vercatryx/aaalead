import { NextResponse } from 'next/server';
import { getConnectionConfig } from '../../../db/database';

export async function GET() {
  try {
    const config = getConnectionConfig();
    const masked = config.connectionString.replace(/:[^:@]+@/, ':****@');
    const host = config.connectionString.split('@')[1]?.split('/')[0] || 'unknown';
    
    return NextResponse.json({
      success: true,
      connectionString: masked,
      host: host,
      isPooler: config.connectionString.includes('pooler.supabase.com'),
      isDirect: config.connectionString.includes('db.hxsjkzatrfefeojvaitn.supabase.co'),
      hasEnvVar: !!process.env.DATABASE_URL,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
