const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Get Neon database URL from environment
// It can be in format: postgresql://user:password@host/database?sslmode=require
// Or you can use individual DB_* variables
const getDatabaseConfig = () => {
  // Check if DATABASE_URL is set (primary for Neon, matches connection.ts)
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Neon requires SSL
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
  }
  
  // Check if NEON_DATABASE_URL is set (alternative name)
  if (process.env.NEON_DATABASE_URL) {
    return {
      connectionString: process.env.NEON_DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Neon requires SSL
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
  }
  
  // Fall back to individual connection parameters (for Neon, SSL is required)
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false } // Neon requires SSL
  };
};

async function runMigration() {
  const pool = new Pool(getDatabaseConfig());
  const client = await pool.connect();
  
  try {
    console.log('🔗 Connecting to Neon database...');
    console.log(`   Using: ${process.env.NEON_DATABASE_URL ? 'NEON_DATABASE_URL' : process.env.DATABASE_URL ? 'DATABASE_URL' : 'Individual connection parameters'}`);
    
    // Test connection
    await client.query('SELECT NOW()');
    console.log('✅ Connected to Neon database successfully');
    
    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Get the latest migration file
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    if (migrationFiles.length === 0) {
      throw new Error('No migration files found');
    }
    
    const migrationFile = migrationFiles[migrationFiles.length - 1];
    const migrationPath = path.join(migrationsDir, migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const version = migrationFile.replace('.sql', '');
    
    // Check if migration has been executed
    const result = await client.query(
      'SELECT version FROM schema_migrations WHERE version = $1',
      [version]
    );
    
    if (result.rows.length > 0) {
      console.log(`⚠️  Migration ${migrationFile} has already been executed on Neon database`);
      console.log(`   Executed at: ${result.rows[0].executed_at}`);
      return;
    }
    
    console.log(`📝 Running migration: ${migrationFile}`);
    
    // Read migration file
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Run migration in a transaction
    await client.query('BEGIN');
    
    try {
      await client.query(migrationSQL);
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1)',
        [version]
      );
      await client.query('COMMIT');
      
      console.log(`✅ Migration ${migrationFile} completed successfully on Neon database!`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('🎉 Neon migration process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });

