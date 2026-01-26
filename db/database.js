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
  // IMPORTANT: The direct connection is IPv6-only and not IPv4 compatible
  // We MUST use the Session Pooler connection string for IPv4 networks
  // Session mode (port 5432) supports prepared statements and is IPv4 compatible
  
  const PROJECT_REF = 'hxsjkzatrfefeojvaitn';
  const PASSWORD = 'LeadClean^467';
  
  // Use Session Pooler connection string (IPv4 compatible, supports prepared statements)
  // Format: postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
  // Verified working region: us-west-2
  const region = process.env.SUPABASE_POOLER_REGION || 'us-west-2';
  const defaultPoolerConnectionString = `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(PASSWORD)}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
  
  // Use DATABASE_URL if provided, otherwise use pooler connection string
  const connectionString = process.env.DATABASE_URL || defaultPoolerConnectionString;
  
  // Log which connection string is being used (for debugging)
  if (process.env.DATABASE_URL) {
    console.log('🔧 Using DATABASE_URL from environment variable');
  } else {
    console.log('🔧 Using default Supabase Session Pooler connection string');
  }
  console.log('🔧 Connection host:', connectionString.includes('pooler.supabase.com') ? 'Session Pooler (IPv4 compatible)' : 'Direct connection (IPv6 only)');
  
  return {
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false // Supabase requires SSL
    },
    // Connection pool settings
    // Supabase Session Pooler has a limit (typically 15 connections)
    // Reduce pool size to avoid "max clients reached" errors
    max: 10, // Maximum number of clients in the pool (reduced for Supabase Session Pooler)
    idleTimeoutMillis: 10000, // Close idle clients after 10 seconds (faster cleanup)
    connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection cannot be established
    allowExitOnIdle: true, // Allow pool to close when idle
  };
}

async function initializeDatabaseModule() {
  if (dbInitialized) {
    return pool !== null;
  }
  dbInitialized = true;
  
  try {
    const config = getConnectionConfig();
    console.log('🔌 Attempting to connect to PostgreSQL database...');
    
    const masked = config.connectionString.replace(/:[^:@]+@/, ':****@');
    console.log('🔌 Using connection string (masked):', masked);
    
    // Verify we're using the pooler, not the direct connection
    if (config.connectionString.includes('db.hxsjkzatrfefeojvaitn.supabase.co')) {
      console.error('❌ WARNING: Using direct connection (IPv6 only)! This will fail on IPv4 networks.');
      console.error('❌ Please use the Session Pooler connection string instead.');
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
