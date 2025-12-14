import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Detect if running on Vercel (hosted) or locally
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
const isLocal = !isVercel;

// Default database mode: 'neon' for Vercel (always), 'local' for local Electron app
// Can be overridden via DB_MODE environment variable
// When on Vercel, always use Neon. When local, default to local PostgreSQL but can switch to Neon
let currentDbMode: 'local' | 'neon' = isVercel 
  ? 'neon' 
  : (process.env.DB_MODE as 'local' | 'neon' || 'local');

// Local PostgreSQL connection config
// Ensure password is always a string (PostgreSQL requires string type)
// Handle cases where DB_PASSWORD might be undefined, null, or empty
const dbPassword = process.env.DB_PASSWORD;
let passwordString: string;
if (dbPassword === undefined || dbPassword === null) {
  passwordString = '';
} else {
  passwordString = String(dbPassword);
}

const localConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'awesome_invoice_db',
  user: process.env.DB_USER || 'postgres',
  password: passwordString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: false,
};

// Neon database connection config
const neonConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : null;

// Create separate pools for local and Neon
// Validate local config before creating pool
if (typeof localConfig.password !== 'string') {
  console.error('❌ DB_PASSWORD must be a string. Current type:', typeof localConfig.password);
  throw new Error('Database password configuration error: password must be a string');
}

const localPool = new Pool(localConfig);
let neonPool: Pool | null = null;

if (neonConfig) {
  neonPool = new Pool(neonConfig);
}

// Get the active pool based on current mode
export const getPool = (): Pool => {
  if (currentDbMode === 'neon') {
    if (!neonPool) {
      throw new Error('Neon database not configured. DATABASE_URL is required.');
    }
    return neonPool;
  }
  return localPool;
};

// Get local pool (for sync operations)
export const getLocalPool = (): Pool => {
  return localPool;
};

// Get Neon pool (for sync operations)
export const getNeonPool = (): Pool => {
  if (!neonPool) {
    throw new Error('Neon database not configured. DATABASE_URL is required.');
  }
  return neonPool;
};

// Set database mode (only allowed when running locally)
export const setDbMode = (mode: 'local' | 'neon'): void => {
  if (isVercel) {
    throw new Error('Cannot change database mode on Vercel. Always uses Neon database.');
  }
  if (mode === 'neon' && !neonPool) {
    throw new Error('Neon database not configured. DATABASE_URL is required.');
  }
  currentDbMode = mode;
  console.log(`Database mode switched to: ${mode}`);
};

// Get current database mode
export const getDbMode = (): 'local' | 'neon' => {
  return currentDbMode;
};

// Check if running on Vercel
export const isRunningOnVercel = (): boolean => {
  return isVercel;
};

// Check if running locally
export const isRunningLocally = (): boolean => {
  return isLocal;
};

// Default export for backward compatibility
// Create a Proxy that always returns the current active pool
const poolProxy = new Proxy({} as Pool, {
  get(target, prop) {
    const activePool = getPool();
    const value = (activePool as any)[prop];
    if (typeof value === 'function') {
      return value.bind(activePool);
    }
    return value;
  },
  set(target, prop, value) {
    const activePool = getPool();
    (activePool as any)[prop] = value;
    return true;
  },
  has(target, prop) {
    const activePool = getPool();
    return prop in activePool;
  },
  ownKeys(target) {
    const activePool = getPool();
    return Object.keys(activePool);
  },
  getOwnPropertyDescriptor(target, prop) {
    const activePool = getPool();
    return Object.getOwnPropertyDescriptor(activePool, prop);
  }
});

export { poolProxy as pool };
export default poolProxy;

// Connect to database
export const connectDB = async (): Promise<void> => {
  try {
    const activePool = getPool();
    const client = await activePool.connect();
    console.log(`Database connected successfully (mode: ${currentDbMode}, environment: ${isVercel ? 'Vercel' : 'Local'})`);
    client.release();
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};

// Connect to both databases (for sync operations)
export const connectBothDBs = async (): Promise<{ local: Pool; neon: Pool }> => {
  try {
    // Test local connection
    const localClient = await localPool.connect();
    localClient.release();
    console.log('Local database connected successfully');

    // Test Neon connection
    if (!neonPool) {
      throw new Error('Neon database not configured');
    }
    const neonClient = await neonPool.connect();
    neonClient.release();
    console.log('Neon database connected successfully');

    return { local: localPool, neon: neonPool };
  } catch (error) {
    console.error('Failed to connect to databases:', error);
    throw error;
  }
};