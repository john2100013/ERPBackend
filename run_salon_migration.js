const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Connected to database...');
    
    const migrationPath = path.join(__dirname, 'migrations', '016_create_salon_module_fixed.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running salon module migration...');
    await client.query(sql);
    
    console.log('✅ Salon module migration completed successfully!');
    console.log('\nCreated tables:');
    console.log('  - salon_users');
    console.log('  - salon_services');
    console.log('  - salon_products');
    console.log('  - salon_shifts');
    console.log('  - salon_transactions');
    console.log('  - salon_product_usage');
    console.log('  - salon_employee_performance');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
