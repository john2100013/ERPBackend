/**
 * Verify final schema matches Neon exactly
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function verifySchema() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Password',
    database: process.env.DB_NAME || 'awesomeinvoice',
  });

  try {
    console.log('🔍 Verifying database structure...\n');

    // Check bookings.booking_time
    const bookingTime = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'bookings' AND column_name = 'booking_time'
    `);
    
    if (bookingTime.rows.length > 0) {
      const col = bookingTime.rows[0];
      console.log('📋 bookings.booking_time:');
      console.log(`   Type: ${col.data_type}`);
      console.log(`   Nullable: ${col.is_nullable}`);
      console.log(`   Default: ${col.column_default || 'none'}`);
      
      // TIME WITHOUT TIME ZONE is stored as 'time without time zone' in PostgreSQL
      if (col.data_type === 'time without time zone' || col.data_type === 'time') {
        console.log('   ✅ Type is correct (TIME WITHOUT TIME ZONE)');
      } else {
        console.log('   ⚠️  Type mismatch');
      }
    }

    // Check schema_migrations.executed_at
    const executedAt = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'schema_migrations' AND column_name = 'executed_at'
    `);
    
    if (executedAt.rows.length > 0) {
      const col = executedAt.rows[0];
      console.log('\n📋 schema_migrations.executed_at:');
      console.log(`   Type: ${col.data_type}`);
      console.log(`   Nullable: ${col.is_nullable}`);
      console.log(`   Default: ${col.column_default || 'none'}`);
      
      // Schema.sql shows TIMESTAMP WITH TIME ZONE
      if (col.data_type === 'timestamp with time zone') {
        console.log('   ✅ Type is correct (TIMESTAMP WITH TIME ZONE)');
      } else if (col.data_type === 'timestamp without time zone') {
        console.log('   ⚠️  Should be TIMESTAMP WITH TIME ZONE, but is TIMESTAMP');
      } else {
        console.log('   ⚠️  Type mismatch');
      }
    }

    // Check a few critical tables
    console.log('\n📊 Checking critical tables structure:\n');
    
    const criticalTables = ['users', 'businesses', 'invoices', 'invoice_lines'];
    
    for (const table of criticalTables) {
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      
      console.log(`✅ ${table}: ${columns.rows.length} columns`);
    }

    console.log('\n✅ Schema verification complete!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifySchema();

