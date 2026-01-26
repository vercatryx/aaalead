import { NextResponse } from 'next/server';
import pg from 'pg';
const { Pool } = pg;

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: [],
    recommendations: []
  };

  // Test 1: Check if pg module is available
  results.tests.push({
    name: 'pg module check',
    status: 'success',
    message: 'pg module is available'
  });

  // Test 2: DNS lookup test
  try {
    const dns = await import('dns/promises');
    try {
      const addresses = await dns.lookup('db.hxsjkzatrfefeojvaitn.supabase.co');
      results.tests.push({
        name: 'DNS lookup',
        status: 'success',
        message: `DNS resolved to: ${addresses.address} (family: ${addresses.family})`
      });
    } catch (error: any) {
      results.tests.push({
        name: 'DNS lookup',
        status: 'failed',
        error: error.message,
        code: error.code,
        message: 'The hostname cannot be resolved. This usually means: 1) The hostname is incorrect, 2) The Supabase project is paused/deleted, or 3) Network/DNS issue'
      });
      results.recommendations.push('Verify the connection string in your Supabase dashboard');
      results.recommendations.push('Check if your Supabase project is active (not paused)');
    }
  } catch (error: any) {
    results.tests.push({
      name: 'DNS lookup',
      status: 'skipped',
      message: 'DNS module not available'
    });
  }

  // Test 3: Try connection with current connection string
  // Note: If DATABASE_URL is not set, this test will fail - which is expected
  // Users should set DATABASE_URL in their .env.local file
  if (!process.env.DATABASE_URL) {
    results.tests.push({
      name: 'Database connection',
      status: 'skipped',
      message: 'DATABASE_URL environment variable is not set. Please configure it in your .env.local file.'
    });
    results.instructions = [
      '1. Go to your Supabase Dashboard: https://supabase.com/dashboard',
      '2. Select your project',
      '3. Go to Settings → Database',
      '4. Find the "Connection string" section',
      '5. Copy the "URI" connection string (it should look like: postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres)',
      '6. Update the DATABASE_URL environment variable in your .env.local file',
      '7. Make sure your Supabase project is not paused'
    ];
    return NextResponse.json(results, { status: 200 });
  }
  
  const connectionString = process.env.DATABASE_URL;
  
  let pool = null;
  try {
    pool = new Pool({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });

    const client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 5 seconds')), 5000)
      )
    ]) as any;

    await client.query('SELECT NOW()');
    client.release();
    await pool.end();

    results.tests.push({
      name: 'Database connection',
      status: 'success',
      message: 'Successfully connected to database!'
    });
  } catch (error: any) {
    results.tests.push({
      name: 'Database connection',
      status: 'failed',
      error: error.message,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      hostname: error.hostname
    });

    if (error.code === 'ENOTFOUND') {
      results.recommendations.push('DNS lookup failed - verify the hostname in your Supabase dashboard');
      results.recommendations.push('Get the correct connection string from: Supabase Dashboard → Settings → Database → Connection string');
    } else if (error.code === 'ETIMEDOUT') {
      results.recommendations.push('Connection timeout - check your network/firewall settings');
    } else if (error.message?.includes('password')) {
      results.recommendations.push('Authentication failed - verify the password is correct');
    }
    
    if (pool) {
      try {
        await pool.end();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  // Add instructions
  results.instructions = [
    '1. Go to your Supabase Dashboard: https://supabase.com/dashboard',
    '2. Select your project',
    '3. Go to Settings → Database',
    '4. Find the "Connection string" section',
    '5. Copy the "URI" connection string (it should look like: postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres)',
    '6. Update the DATABASE_URL environment variable or the defaultConnectionString in db/database.js',
    '7. Make sure your Supabase project is not paused'
  ];

  return NextResponse.json(results, { status: 200 });
}
