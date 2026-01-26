import { NextResponse } from 'next/server';
import { getConnectionConfig, getDatabase, isDatabaseAvailable } from '../../../db/database.js';

export async function GET() {
  try {
    // Check environment variables (without exposing secrets)
    const envCheck = {
      hasDATABASE_URL: !!process.env.DATABASE_URL,
      hasSUPABASE_PROJECT_REF: !!process.env.SUPABASE_PROJECT_REF,
      hasSUPABASE_DB_PASSWORD: !!process.env.SUPABASE_DB_PASSWORD,
      SUPABASE_PROJECT_REF_length: process.env.SUPABASE_PROJECT_REF?.length || 0,
      SUPABASE_DB_PASSWORD_length: process.env.SUPABASE_DB_PASSWORD?.length || 0,
      SUPABASE_POOLER_REGION: process.env.SUPABASE_POOLER_REGION || 'not set (will use default)',
    };
    
    const config = getConnectionConfig();
    const masked = config.connectionString.replace(/:[^:@]+@/, ':****@');
    const host = config.connectionString.split('@')[1]?.split('/')[0] || 'unknown';
    
    // Test database connection
    let dbTest = null;
    try {
      const available = isDatabaseAvailable();
      if (available) {
        const pool = await getDatabase();
        const result = await pool.query('SELECT NOW() as current_time');
        dbTest = {
          connected: true,
          current_time: result.rows[0].current_time
        };
      } else {
        dbTest = {
          connected: false,
          error: 'Database pool not initialized'
        };
      }
    } catch (dbError: any) {
      dbTest = {
        connected: false,
        error: dbError.message
      };
    }
    
    return NextResponse.json({
      success: true,
      connectionString: masked,
      host: host,
      isPooler: config.connectionString.includes('pooler.supabase.com'),
      isDirect: config.connectionString.includes('db.hxsjkzatrfefeojvaitn.supabase.co'),
      envCheck,
      dbTest,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      envCheck: {
        hasDATABASE_URL: !!process.env.DATABASE_URL,
        hasSUPABASE_PROJECT_REF: !!process.env.SUPABASE_PROJECT_REF,
        hasSUPABASE_DB_PASSWORD: !!process.env.SUPABASE_DB_PASSWORD,
      },
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
