// Test pooler connection with different regions
import pg from 'pg';
const { Pool } = pg;

const PROJECT_REF = 'hxsjkzatrfefeojvaitn';
const PASSWORD = 'LeadClean^467';

const regions = ['us-east-1', 'us-west-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-southeast-1', 'ap-northeast-1'];

console.log('Testing Session Pooler connections (port 5432)...\n');

for (const region of regions) {
  const connectionString = `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(PASSWORD)}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
  console.log(`Testing ${region}...`);
  
  try {
    const pool = new Pool({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
    
    const client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      )
    ]);
    
    const result = await client.query('SELECT NOW()');
    console.log(`✅ ${region} WORKS! Server time: ${result.rows[0].now}`);
    console.log(`   Connection string: ${connectionString.replace(/:[^:@]+@/, ':****@')}`);
    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.log(`   ❌ ${region}: ${error.message}`);
    try {
      await pool?.end();
    } catch (e) {
      // Ignore
    }
  }
}

console.log('\nAll regions failed. Trying transaction mode (port 6543)...\n');

for (const region of regions) {
  const connectionString = `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(PASSWORD)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
  console.log(`Testing ${region} (transaction mode)...`);
  
  try {
    const pool = new Pool({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
    
    const client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      )
    ]);
    
    const result = await client.query('SELECT NOW()');
    console.log(`✅ ${region} WORKS (transaction mode)! Server time: ${result.rows[0].now}`);
    console.log(`   Connection string: ${connectionString.replace(/:[^:@]+@/, ':****@')}`);
    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.log(`   ❌ ${region}: ${error.message}`);
    try {
      await pool?.end();
    } catch (e) {
      // Ignore
    }
  }
}

console.log('\n❌ All connection attempts failed.');
