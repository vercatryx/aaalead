// Test database connection script
import pg from 'pg';
const { Pool } = pg;
import dns from 'dns/promises';

// Load environment variables (optional - Next.js handles this automatically)
try {
  const dotenv = (await import('dotenv')).default;
  dotenv.config({ path: '.env.local' });
} catch (e) {
  // dotenv not installed, assume environment variables are set
  console.log('Note: dotenv not found, using environment variables directly');
}

const HOSTNAME = process.env.SUPABASE_HOSTNAME || 'db.hxsjkzatrfefeojvaitn.supabase.co';
const PORT = parseInt(process.env.SUPABASE_PORT || '5432');
const DATABASE = process.env.SUPABASE_DATABASE || 'postgres';
const USER = process.env.SUPABASE_USER || 'postgres';
const PASSWORD = process.env.SUPABASE_DB_PASSWORD;

if (!PASSWORD) {
  console.error('❌ Error: SUPABASE_DB_PASSWORD environment variable is not set');
  console.error('   Please set it in your .env.local file');
  process.exit(1);
}
const KNOWN_IPV6 = '2600:1f13:838:6e12:6d71:b3c1:520c:36af';

console.log('=== Database Connection Test ===\n');

// Test 1: DNS Resolution
console.log('1. Testing DNS resolution...');
try {
  const addresses = await dns.lookup(HOSTNAME, { family: 6 });
  console.log(`   ✅ IPv6 resolved: ${addresses.address}`);
} catch (error) {
  console.log(`   ❌ IPv6 resolution failed: ${error.message}`);
}

try {
  const addresses = await dns.lookup(HOSTNAME, { family: 4 });
  console.log(`   ✅ IPv4 resolved: ${addresses.address}`);
} catch (error) {
  console.log(`   ❌ IPv4 resolution failed: ${error.message}`);
}

try {
  const addresses = await dns.lookup(HOSTNAME);
  console.log(`   ✅ Auto resolved: ${addresses.address} (family: ${addresses.family})`);
} catch (error) {
  console.log(`   ❌ Auto resolution failed: ${error.message}`);
}

// Test 2: Connection with hostname
console.log('\n2. Testing connection with hostname...');
try {
  const pool = new Pool({
    host: HOSTNAME,
    port: PORT,
    database: DATABASE,
    user: USER,
    password: PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  
  const client = await Promise.race([
    pool.connect(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 10000)
    )
  ]);
  
  const result = await client.query('SELECT NOW()');
  console.log(`   ✅ Connection successful! Server time: ${result.rows[0].now}`);
  client.release();
  await pool.end();
} catch (error) {
  console.log(`   ❌ Connection failed: ${error.message}`);
  console.log(`   Error code: ${error.code}`);
  console.log(`   Error syscall: ${error.syscall}`);
}

// Test 3: Connection with IPv6 address directly
console.log('\n3. Testing connection with IPv6 address directly...');
try {
  const pool = new Pool({
    host: KNOWN_IPV6,
    port: PORT,
    database: DATABASE,
    user: USER,
    password: PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  
  const client = await Promise.race([
    pool.connect(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 10000)
    )
  ]);
  
  const result = await client.query('SELECT NOW()');
  console.log(`   ✅ Connection successful! Server time: ${result.rows[0].now}`);
  client.release();
  await pool.end();
} catch (error) {
  console.log(`   ❌ Connection failed: ${error.message}`);
  console.log(`   Error code: ${error.code}`);
}

// Test 4: Connection with connection string
console.log('\n4. Testing connection with connection string...');
const connectionString = `postgresql://${USER}:${encodeURIComponent(PASSWORD)}@${HOSTNAME}:${PORT}/${DATABASE}`;
try {
  const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  
  const client = await Promise.race([
    pool.connect(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 10000)
    )
  ]);
  
  const result = await client.query('SELECT NOW()');
  console.log(`   ✅ Connection successful! Server time: ${result.rows[0].now}`);
  client.release();
  await pool.end();
} catch (error) {
  console.log(`   ❌ Connection failed: ${error.message}`);
  console.log(`   Error code: ${error.code}`);
}

// Test 5: Try Supabase pooler connection (transaction mode)
console.log('\n5. Testing Supabase pooler (transaction mode)...');
// Supabase pooler uses a different hostname format
const poolerHost = HOSTNAME.replace('db.', 'aws-0-us-east-1.pooler.supabase.com');
const poolerConnectionString = `postgresql://${USER}.default:${encodeURIComponent(PASSWORD)}@${poolerHost}:6543/${DATABASE}?pgbouncer=true`;
console.log(`   Trying pooler: ${poolerHost}`);
try {
  const pool = new Pool({
    connectionString: poolerConnectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  
  const client = await Promise.race([
    pool.connect(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 10000)
    )
  ]);
  
  const result = await client.query('SELECT NOW()');
  console.log(`   ✅ Pooler connection successful! Server time: ${result.rows[0].now}`);
  client.release();
  await pool.end();
} catch (error) {
  console.log(`   ❌ Pooler connection failed: ${error.message}`);
  console.log(`   Error code: ${error.code}`);
}

// Test 6: Try different hostname variations
console.log('\n6. Testing hostname variations...');
const hostnameVariations = [
  HOSTNAME,
  HOSTNAME.replace('.supabase.co', '.supabase.com'),
  `pooler.${HOSTNAME.replace('db.', '')}`,
];

for (const host of hostnameVariations) {
  if (host === HOSTNAME) continue; // Already tested
  console.log(`   Trying: ${host}`);
  try {
    const pool = new Pool({
      host: host,
      port: PORT,
      database: DATABASE,
      user: USER,
      password: PASSWORD,
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
    console.log(`   ✅ ${host} works!`);
    client.release();
    await pool.end();
    break;
  } catch (error) {
    console.log(`   ❌ ${host}: ${error.code || error.message}`);
  }
}

console.log('\n=== Recommendations ===');
console.log('1. Verify the hostname in Supabase Dashboard → Settings → Database');
console.log('2. Check if your Supabase project is paused');
console.log('3. Try using the "Connection pooling" connection string from Supabase');
console.log('4. Check your network/firewall settings');
console.log('5. The hostname might have changed - get the latest from Supabase dashboard');

console.log('\n=== Test Complete ===');
