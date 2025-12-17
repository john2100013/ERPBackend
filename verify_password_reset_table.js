const { Pool } = require('pg');
require('dotenv').config();

async function verifyTable() {
  // Check local database
  const localPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'awesome_invoice_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: false,
  });

  // Check Neon database
  const neonConfig = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  const neonPool = neonConfig ? new Pool({ connectionString: neonConfig }) : null;

  try {
    console.log('🔍 Verifying password_reset_tokens table...\n');

    // Check local database
    console.log('📊 Local PostgreSQL Database:');
    const localResult = await localPool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'password_reset_tokens'
      ORDER BY ordinal_position
    `);

    if (localResult.rows.length > 0) {
      console.log('   ✅ Table exists with columns:');
      localResult.rows.forEach(row => {
        console.log(`      - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
      });
    } else {
      console.log('   ❌ Table not found!');
    }

    // Check Neon database
    if (neonPool) {
      console.log('\n📊 Neon Database:');
      const neonResult = await neonPool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'password_reset_tokens'
        ORDER BY ordinal_position
      `);

      if (neonResult.rows.length > 0) {
        console.log('   ✅ Table exists with columns:');
        neonResult.rows.forEach(row => {
          console.log(`      - ${row.column_name} (${row.data_type}, nullable: ${row.is_nullable})`);
        });
      } else {
        console.log('   ❌ Table not found!');
      }
    } else {
      console.log('\n⚠️  Neon database URL not configured, skipping verification');
    }

    console.log('\n✅ Verification complete!');
  } catch (error) {
    console.error('❌ Error verifying table:', error.message);
  } finally {
    await localPool.end();
    if (neonPool) {
      await neonPool.end();
    }
  }
}

verifyTable();

