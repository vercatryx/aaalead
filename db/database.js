// PostgreSQL database connection using Supabase
// This file should only be used in server-side code (API routes)
if (typeof window !== 'undefined') {
  throw new Error('Database module cannot be used in client-side code');
}

import pg from 'pg';
const { Pool } = pg;

let pool = null;
let dbInitialized = false;

// Connection configuration from Supabase
// Using Session Pooler connection string for IPv4 compatibility

export function getConnectionConfig() {
  // Get credentials from environment variables
  const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
  const PASSWORD = process.env.SUPABASE_DB_PASSWORD;
  
  // Default to direct connection (faster and more reliable)
  // Set SUPABASE_USE_POOLER=true to use pooler instead
  const useDirectConnection = process.env.SUPABASE_USE_POOLER !== 'true' && process.env.SUPABASE_USE_POOLER !== '1';
  
  // If DATABASE_URL is provided, use it directly
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Supabase requires SSL
      },
      // Connection pool settings
      max: 20, // More connections allowed for direct connection
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection cannot be established
      allowExitOnIdle: true, // Allow pool to close when idle
    };
  }
  
  // Validate required environment variables
  if (!PROJECT_REF || !PASSWORD) {
    throw new Error(
      'Missing required Supabase credentials. Please set either DATABASE_URL or both SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD in your .env.local file.'
    );
  }
  
  let connectionString;
  let connectionType;
  let poolConfig;
  
  if (useDirectConnection) {
    // Use direct connection (IPv6 only, but faster and more reliable)
    // Format: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
    connectionString = `postgresql://postgres:${encodeURIComponent(PASSWORD)}@db.${PROJECT_REF}.supabase.co:5432/postgres`;
    connectionType = 'Direct connection (IPv6)';
    poolConfig = {
      max: 20, // More connections allowed for direct connection
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: true,
    };
  } else {
    // Use Session Pooler connection string (IPv4 compatible, supports prepared statements)
    // Format: postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
    const region = process.env.SUPABASE_POOLER_REGION || 'us-west-2';
    connectionString = `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(PASSWORD)}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
    connectionType = 'Session Pooler (IPv4 compatible)';
    poolConfig = {
      max: 10, // Reduced for Session Pooler limits
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
      allowExitOnIdle: true,
    };
  }
  
  // Log which connection string is being used (for debugging)
  console.log(`🔧 Using ${connectionType}`);
  console.log(`🔧 Connection: ${useDirectConnection ? 'Direct (faster)' : 'Pooler (IPv4 compatible)'}`);
  
  return {
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false // Supabase requires SSL
    },
    ...poolConfig,
  };
}

async function initializeDatabaseModule() {
  if (dbInitialized) {
    return pool !== null;
  }
  dbInitialized = true;
  
  try {
    // Debug: Log environment variables (without exposing secrets)
    console.log('🔍 Environment variables check:', {
      hasDATABASE_URL: !!process.env.DATABASE_URL,
      hasSUPABASE_PROJECT_REF: !!process.env.SUPABASE_PROJECT_REF,
      hasSUPABASE_DB_PASSWORD: !!process.env.SUPABASE_DB_PASSWORD,
      SUPABASE_PROJECT_REF_length: process.env.SUPABASE_PROJECT_REF?.length || 0,
      SUPABASE_DB_PASSWORD_length: process.env.SUPABASE_DB_PASSWORD?.length || 0,
    });
    
    const config = getConnectionConfig();
    console.log('🔌 Attempting to connect to PostgreSQL database...');
    
    const masked = config.connectionString.replace(/:[^:@]+@/, ':****@');
    console.log('🔌 Using connection string (masked):', masked);
    
    // Log connection type
    if (config.connectionString.includes('db.') && config.connectionString.includes('.supabase.co')) {
      console.log('✅ Using direct connection (faster, IPv6)');
    } else if (config.connectionString.includes('pooler.supabase.com')) {
      console.log('✅ Using pooler connection (IPv4 compatible)');
    }
    
    pool = new Pool(config);
    
    // Test the connection with timeout
    const client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
      )
    ]);
    
    await client.query('SELECT NOW()');
    client.release();
    
    console.log('✅ Database connection test successful');
    
    // Initialize database schema
    await initializeDatabase();
    
    console.log('✅ PostgreSQL database initialized successfully');
    return true;
  } catch (error) {
    lastConnectionError = error;
    console.error('❌ Failed to initialize PostgreSQL database:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      errno: error?.errno,
      syscall: error?.syscall,
      hostname: error?.hostname,
      stack: error?.stack
    });
    pool = null;
    return false;
  }
}

let lastConnectionError = null;

export async function getDatabase() {
  const initialized = await initializeDatabaseModule();
  if (!pool || !initialized) {
    const errorMsg = lastConnectionError 
      ? `Database is not available. PostgreSQL connection failed: ${lastConnectionError.message}`
      : 'Database is not available. PostgreSQL connection failed.';
    throw new Error(errorMsg);
  }
  return pool;
}

export function isDatabaseAvailable() {
  return pool !== null;
}

// Synchronous version for models.js compatibility
// Note: This will return the pool, but queries should be async
export function getDatabaseSync() {
  if (!dbInitialized) {
    throw new Error('Database not initialized. Call initializeDatabaseModule() first.');
  }
  if (!pool) {
    throw new Error('Database is not available. PostgreSQL connection failed.');
  }
  return pool;
}

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Create inspectors table
    await client.query(`
      CREATE TABLE IF NOT EXISTS inspectors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      )
    `);

    // Create inspector_variables table
    await client.query(`
      CREATE TABLE IF NOT EXISTS inspector_variables (
        inspector_id TEXT NOT NULL,
        variable_name TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (inspector_id, variable_name),
        FOREIGN KEY (inspector_id) REFERENCES inspectors(id) ON DELETE CASCADE
      )
    `);

    // Create inspector_variable_names table (global variable names)
    await client.query(`
      CREATE TABLE IF NOT EXISTS inspector_variable_names (
        variable_name TEXT PRIMARY KEY
      )
    `);

    // Create document_types table
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_types (
        type TEXT PRIMARY KEY,
        category TEXT NOT NULL
      )
    `);

    // Create general_variables table
    await client.query(`
      CREATE TABLE IF NOT EXISTS general_variables (
        variable_name TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Create documents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        category TEXT NOT NULL,
        document_type TEXT,
        inspector_id TEXT,
        FOREIGN KEY (document_type) REFERENCES document_types(type),
        FOREIGN KEY (inspector_id) REFERENCES inspectors(id) ON DELETE CASCADE
      )
    `);
  } finally {
    client.release();
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (pool) {
    await pool.end();
  }
});

process.on('SIGTERM', async () => {
  if (pool) {
    await pool.end();
  }
});
