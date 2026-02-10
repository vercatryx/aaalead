// PostgreSQL database connection using Supabase
// This file should only be used in server-side code (API routes)
if (typeof window !== 'undefined') {
  throw new Error('Database module cannot be used in client-side code');
}

import pg from 'pg';
const { Pool } = pg;

let pool = null;
let dbInitialized = false;
let initializationPromise = null; // Track ongoing initialization to prevent race conditions

// Connection configuration from Supabase
// Using Session Pooler connection string for IPv4 compatibility

export function getConnectionConfig() {
  // Get credentials from environment variables
  const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
  const PASSWORD = process.env.SUPABASE_DB_PASSWORD;

  // Auto-detect Vercel environment
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

  // Connection strategy:
  // - Local: Default to direct connection (faster, works with IPv6)
  // - Vercel: Default to pooler (IPv4), but can try direct if SUPABASE_USE_DIRECT=true
  //   Note: Vercel serverless functions may not support IPv6, so direct may fail
  //   The code will automatically fall back to pooler if direct fails
  // - Set SUPABASE_USE_POOLER=true to force pooler
  // - Set SUPABASE_USE_DIRECT=true to force direct (will try even on Vercel)
  // - Set SUPABASE_USE_DIRECT=false to disable direct (will use pooler)
  const forceDirect = process.env.SUPABASE_USE_DIRECT === 'true' || process.env.SUPABASE_USE_DIRECT === '1';
  const forcePooler = process.env.SUPABASE_USE_POOLER === 'true' || process.env.SUPABASE_USE_POOLER === '1';
  const disableDirect = process.env.SUPABASE_USE_DIRECT === 'false' || process.env.SUPABASE_USE_DIRECT === '0';

  // Use direct connection if:
  // - Not disabled AND
  // - (Explicitly forced OR (not on Vercel AND not forcing pooler))
  // This allows trying direct on Vercel if explicitly enabled
  const useDirectConnection = !disableDirect && (forceDirect || (!isVercel && !forcePooler));

  // If DATABASE_URL is provided, use it directly (prefer port 6543 on Vercel to avoid "max clients reached")
  if (process.env.DATABASE_URL) {
    let connectionString = process.env.DATABASE_URL;
    if (connectionString.includes(':6543/') && !connectionString.includes('pgbouncer=true')) {
      const sep = connectionString.includes('?') ? '&' : '?';
      connectionString = `${connectionString}${sep}pgbouncer=true`;
    }
    return {
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: isVercel ? 1 : 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: true,
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
    // Use Transaction Pooler connection string (IPv4 compatible, better for serverless)
    // Port 6543 = Transaction mode: pooler multiplexes many clients over few DB connections (recommended for Vercel).
    // Port 5432 = Session mode: one DB connection per client; limited to pool_size → "max clients reached" on serverless.
    const region = process.env.SUPABASE_POOLER_REGION || 'us-west-2';
    // Default to transaction mode on Vercel to avoid "MaxClientsInSessionMode: max clients reached"
    const useTransactionMode =
      process.env.SUPABASE_USE_TRANSACTION_MODE === 'true' ||
      (isVercel && process.env.SUPABASE_USE_TRANSACTION_MODE !== 'false');

    if (useTransactionMode) {
      // Transaction mode (port 6543) - serverless-optimized; avoids max clients limit
      connectionString = `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(PASSWORD)}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true`;
      connectionType = 'Transaction Pooler (port 6543, serverless-optimized)';
    } else {
      // Session mode (port 5432) - one connection per client; use only when not on Vercel or when explicitly set
      connectionString = `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(PASSWORD)}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
      connectionType = 'Session Pooler (port 5432)';
    }

    poolConfig = {
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      allowExitOnIdle: !!isVercel, // Release when idle on serverless to reduce connection churn
    };
  }

  // Log connection type only in development or if explicitly enabled
  if (process.env.NODE_ENV === 'development' || process.env.SUPABASE_DEBUG === 'true') {
    if (isVercel) {
      console.log('🌐 Vercel environment detected');
    }
    console.log(`🔧 Using ${connectionType}`);
  }

  return {
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false // Supabase requires SSL
    },
    ...poolConfig,
  };
}

async function initializeDatabaseModule() {
  // If already initialized and pool exists, return success
  if (dbInitialized && pool !== null) {
    // Test if pool is still valid
    try {
      const testClient = await pool.connect();
      testClient.release();
      return true;
    } catch (error) {
      // Pool is invalid, reset and reinitialize
      if (process.env.NODE_ENV === 'development' || process.env.SUPABASE_DEBUG === 'true') {
        console.warn('⚠️ Database pool invalid, reinitializing...');
      }
      await resetDatabaseConnection();
    }
  }

  // If initialization is already in progress, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start new initialization
  initializationPromise = (async () => {
    try {
      dbInitialized = true;
      return await performInitialization();
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

// Reset database connection state (useful for recovery after errors)
export async function resetDatabaseConnection() {
  if (process.env.NODE_ENV === 'development' || process.env.SUPABASE_DEBUG === 'true') {
    console.log('🔄 Resetting database connection...');
  }
  if (pool) {
    try {
      await pool.end();
    } catch (error) {
      // Silently handle cleanup errors
    }
  }
  pool = null;
  dbInitialized = false;
  lastConnectionError = null;
  initializationPromise = null;
}

async function performInitialization() {
  // If there was a previous error, wait before retrying to avoid rate limiting
  // Circuit breaker errors need longer wait times
  if (lastConnectionError) {
    const isCircuitBreaker = lastConnectionError.message?.includes('Circuit breaker') ||
      lastConnectionError.message?.includes('circuit breaker');
    const waitTime = isCircuitBreaker ? 10000 : 2000; // 10s for circuit breaker, 2s for other errors
    if (process.env.NODE_ENV === 'development' || process.env.SUPABASE_DEBUG === 'true') {
      console.log(`⏳ Waiting ${waitTime / 1000}s before retry...`);
    }
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  // Close any existing pool before creating a new one
  if (pool) {
    try {
      await pool.end();
    } catch (error) {
      console.warn('⚠️ Error closing existing pool:', error.message);
    }
    pool = null;
  }

  // Get initial connection config
  let config = getConnectionConfig();
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
  const isDirectAttempt = config.connectionString.includes('db.') && config.connectionString.includes('.supabase.co');

  // Try direct connection first (if configured), with fallback to pooler
  if (isDirectAttempt) {
    if (process.env.NODE_ENV === 'development' || process.env.SUPABASE_DEBUG === 'true') {
      console.log('🔌 Attempting direct connection (IPv6)...');
    }

    try {
      pool = new Pool(config);
      const timeout = 10000; // 10s timeout for direct connection

      const client = await Promise.race([
        pool.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Connection timeout after ${timeout / 1000} seconds`)), timeout)
        )
      ]);

      await client.query('SELECT NOW()');
      client.release();

      if (process.env.NODE_ENV === 'development' || process.env.SUPABASE_DEBUG === 'true') {
        console.log('✅ Direct connection (IPv6) successful');
      }
      await initializeDatabase();
      return true;
    } catch (directError) {
      // Check if this is an IPv6-related error that suggests we should fall back to pooler
      const isIPv6Error = directError?.code === 'ENOTFOUND' ||
        directError?.code === 'EAI_AGAIN' ||
        directError?.code === 'ETIMEDOUT' ||
        directError?.code === 'ECONNREFUSED' ||
        directError?.message?.includes('getaddrinfo');

      if (isIPv6Error && isVercel) {
        if (process.env.NODE_ENV === 'development' || process.env.SUPABASE_DEBUG === 'true') {
          console.log('⚠️ Direct connection failed on Vercel (expected), falling back to pooler...');
        }
      } else if (isIPv6Error) {
        if (process.env.NODE_ENV === 'development' || process.env.SUPABASE_DEBUG === 'true') {
          console.log('⚠️ Direct connection failed, falling back to pooler...');
        }
      } else {
        // Not an IPv6 error, re-throw it
        throw directError;
      }

      // Close the failed direct connection pool
      if (pool) {
        try {
          await pool.end();
        } catch (e) {
          // Ignore cleanup errors
        }
        pool = null;
      }

      // Fall through to try pooler connection
    }
  }

  // Use pooler connection (either as fallback or primary choice)
  try {
    // Construct pooler connection config (same transaction vs session logic as getConnectionConfig)
    const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
    const PASSWORD = process.env.SUPABASE_DB_PASSWORD;
    const region = process.env.SUPABASE_POOLER_REGION || 'us-west-2';
    const isVercelPooler = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
    const useTransactionMode =
      process.env.SUPABASE_USE_TRANSACTION_MODE === 'true' ||
      (isVercelPooler && process.env.SUPABASE_USE_TRANSACTION_MODE !== 'false');

    let poolerConnectionString;
    let poolerType;

    if (useTransactionMode) {
      poolerConnectionString = `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(PASSWORD)}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true`;
      poolerType = 'Transaction Pooler (Port 6543)';
    } else {
      poolerConnectionString = `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(PASSWORD)}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
      poolerType = 'Session Pooler (Port 5432)';
    }

    if (process.env.NODE_ENV === 'development' || process.env.SUPABASE_DEBUG === 'true') {
      console.log(`🔌 Attempting ${poolerType} connection (IPv4)...`);
    }

    config = {
      connectionString: poolerConnectionString,
      ssl: { rejectUnauthorized: false },
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      allowExitOnIdle: !!isVercelPooler,
    };

    pool = new Pool(config);
    const timeout = 20000; // 20s timeout for pooler

    const client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Connection timeout after ${timeout / 1000} seconds`)), timeout)
      )
    ]);

    await client.query('SELECT NOW()');
    client.release();

    if (process.env.NODE_ENV === 'development' || process.env.SUPABASE_DEBUG === 'true') {
      console.log('✅ Pooler connection successful');
    }
    await initializeDatabase();
    return true;
  } catch (error) {
    lastConnectionError = error;
    // Always log errors, but with less detail in production
    if (process.env.NODE_ENV === 'development' || process.env.SUPABASE_DEBUG === 'true') {
      console.error('❌ Failed to initialize PostgreSQL database:', error.message);
      console.error('Error details:', {
        code: error?.code,
        errno: error?.errno,
        syscall: error?.syscall,
        hostname: error?.hostname,
      });

      // Log specific error types for debugging
      if (error?.message?.includes('Circuit breaker')) {
        console.error('⚠️ Circuit breaker is open - Supabase pooler has temporarily disabled connections');
      } else if (error?.code === 'ENOTFOUND') {
        console.error('⚠️ DNS lookup failed - check hostname and network connectivity');
      } else if (error?.code === 'ETIMEDOUT' || error?.code === 'ECONNREFUSED') {
        console.error('⚠️ Connection timeout/refused - check network, firewall, and Supabase project status');
      } else if (error?.message?.includes('password') || error?.message?.includes('authentication')) {
        console.error('⚠️ Authentication failed - verify SUPABASE_DB_PASSWORD is correct');
      }
    } else {
      // Production: minimal logging
      console.error('❌ Database connection failed:', error.message);
    }

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
    const error = new Error(errorMsg);
    // Attach detailed error information for client-side logging (JavaScript-compatible syntax)
    error.dbError = lastConnectionError ? {
      message: lastConnectionError.message,
      code: lastConnectionError.code,
      errno: lastConnectionError.errno,
      syscall: lastConnectionError.syscall,
      hostname: lastConnectionError.hostname,
      stack: lastConnectionError.stack,
    } : null;
    throw error;
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
