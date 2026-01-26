import { NextResponse } from 'next/server';
import pg from 'pg';
const { Pool } = pg;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const connectionType = searchParams.get('type') || 'pooler'; // 'direct', 'pooler', 'pooler-session'
  const region = searchParams.get('region') || process.env.SUPABASE_POOLER_REGION || 'us-west-2';
  
  const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
  const PASSWORD = process.env.SUPABASE_DB_PASSWORD;
  
  if (!PROJECT_REF || !PASSWORD) {
    return NextResponse.json({
      success: false,
      error: 'Missing SUPABASE_PROJECT_REF or SUPABASE_DB_PASSWORD'
    }, { status: 400 });
  }
  
  let connectionString: string;
  let testName: string;
  
  if (connectionType === 'direct') {
    // Direct connection (IPv6)
    connectionString = `postgresql://postgres:${encodeURIComponent(PASSWORD)}@db.${PROJECT_REF}.supabase.co:5432/postgres`;
    testName = 'Direct connection (IPv6)';
  } else if (connectionType === 'pooler-session') {
    // Session pooler (port 5432)
    connectionString = `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(PASSWORD)}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
    testName = `Session Pooler (IPv4, ${region})`;
  } else {
    // Transaction pooler (port 6543)
    connectionString = `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(PASSWORD)}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true`;
    testName = `Transaction Pooler (IPv4, ${region})`;
  }
  
  const masked = connectionString.replace(/:[^:@]+@/, ':****@');
  
  let result: any = {
    success: false,
    connectionType: testName,
    connectionString: masked,
    timestamp: new Date().toISOString()
  };
  
  let pool: pg.Pool | null = null;
  
  try {
    pool = new Pool({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
      max: 1,
    });
    
    const client = await Promise.race([
      pool.connect(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 15 seconds')), 15000)
      )
    ]);
    
    const queryResult = await client.query('SELECT NOW() as current_time, version() as pg_version');
    client.release();
    
    result.success = true;
    result.current_time = queryResult.rows[0].current_time;
    result.pg_version = queryResult.rows[0].pg_version.split(' ')[0] + ' ' + queryResult.rows[0].pg_version.split(' ')[1];
    result.message = 'Connection successful!';
    
  } catch (error: any) {
    result.error = error.message;
    result.code = error.code;
    result.errno = error.errno;
    result.syscall = error.syscall;
    result.hostname = error.hostname;
  } finally {
    if (pool) {
      try {
        await pool.end();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
  
  return NextResponse.json(result);
}
