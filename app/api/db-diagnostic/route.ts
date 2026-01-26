import { NextResponse } from 'next/server';
import { getConnectionConfig, getDatabase, isDatabaseAvailable, resetDatabaseConnection } from '../../../db/database.js';
import pg from 'pg';
import type { PoolClient } from 'pg';
const { Pool } = pg;

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
    
    // Test database connection using existing pool
    let dbTest = null;
    try {
      const available = isDatabaseAvailable();
      if (available) {
        const pool = await getDatabase();
        const result = await pool.query('SELECT NOW() as current_time');
        dbTest = {
          connected: true,
          current_time: result.rows[0].current_time,
          method: 'existing_pool'
        };
      } else {
        dbTest = {
          connected: false,
          error: 'Database pool not initialized',
          method: 'existing_pool'
        };
      }
    } catch (dbError: any) {
      dbTest = {
        connected: false,
        error: dbError.message,
        dbError: dbError.dbError,
        method: 'existing_pool'
      };
    }
    
    // Also try a fresh connection test (bypassing cached pool)
    let freshTest = null;
    try {
      const testPool = new Pool(config);
      const testClient: PoolClient = await Promise.race([
        testPool.connect(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
        )
      ]);
      const result = await testClient.query('SELECT NOW() as current_time');
      testClient.release();
      await testPool.end();
      freshTest = {
        connected: true,
        current_time: result.rows[0].current_time,
        method: 'fresh_connection'
      };
    } catch (freshError: any) {
      freshTest = {
        connected: false,
        error: freshError.message,
        code: freshError.code,
        errno: freshError.errno,
        syscall: freshError.syscall,
        hostname: freshError.hostname,
        method: 'fresh_connection'
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
      freshTest,
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
