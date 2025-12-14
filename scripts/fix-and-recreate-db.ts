/**
 * Fix schema.sql and recreate database
 * Fixes incomplete nextval() calls in schema.sql
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function fixAndRecreate() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Password',
    database: process.env.DB_NAME || 'awesomeinvoice',
  });

  const client = await pool.connect();

  try {
    console.log('🗑️  Dropping all existing tables...\n');

    // Get all tables
    const tablesResult = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
    `);

    const tables = tablesResult.rows.map(row => row.tablename);
    console.log(`Found ${tables.length} tables to drop\n`);

    // Drop all tables (CASCADE to handle foreign keys)
    for (const table of tables) {
      try {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`  ✅ Dropped: ${table}`);
      } catch (error: any) {
        console.error(`  ❌ Error dropping ${table}:`, error.message);
      }
    }

    console.log('\n📖 Reading and fixing schema.sql...');
    const schemaFile = path.join(__dirname, '../schema.sql');
    
    if (!fs.existsSync(schemaFile)) {
      console.error('❌ Error: schema.sql not found');
      console.error('Please run: npm run dump-neon-schema first');
      process.exit(1);
    }

    let schemaSQL = fs.readFileSync(schemaFile, 'utf8');
    
    // Fix incomplete nextval() calls
    // Pattern: DEFAULT nextval('table_seq', should be DEFAULT nextval('table_seq'::regclass)
    schemaSQL = schemaSQL.replace(
      /DEFAULT nextval\('(\w+_id_seq),/g,
      "DEFAULT nextval('$1'::regclass)"
    );

    // Also fix if it's just missing the closing paren
    schemaSQL = schemaSQL.replace(
      /DEFAULT nextval\('(\w+_id_seq)'\s*$/gm,
      "DEFAULT nextval('$1'::regclass)"
    );

    console.log('🔨 Creating tables from fixed schema...\n');

    await client.query('BEGIN');

    // Execute the entire schema SQL
    // Split into logical blocks (each CREATE TABLE block with its constraints)
    const blocks = schemaSQL.split(/\n\n+/);
    
    let created = 0;
    let errors = 0;

    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed || trimmed.startsWith('--')) {
        continue;
      }

      try {
        // Execute the block (may contain multiple statements)
        await client.query(trimmed);
        
        // Extract table name
        const createMatch = trimmed.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i);
        if (createMatch) {
          console.log(`  ✅ Created: ${createMatch[1]}`);
          created++;
        }
      } catch (error: any) {
        errors++;
        const errorCode = error.code;
        const errorMsg = error.message;
        
        // Some errors are expected
        if (errorCode === '42P07' || errorMsg.includes('already exists')) {
          continue;
        }
        
        // Check if it's a nextval error
        if (errorMsg.includes('nextval') || errorMsg.includes('syntax error')) {
          console.error(`  ⚠️  Syntax error in block (may need manual fix):`);
          console.error(`     ${errorMsg}`);
          console.error(`     Block preview: ${trimmed.substring(0, 200).replace(/\n/g, ' ')}...`);
        } else {
          console.error(`  ❌ Error: ${errorMsg}`);
        }
      }
    }

    await client.query('COMMIT');

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Database recreation complete!`);
    console.log(`   Tables created: ${created}`);
    console.log(`   Errors: ${errors}`);
    console.log('='.repeat(60));

    // Verify tables
    const verifyResult = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_tables 
      WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
    `);

    console.log(`\n📊 Total tables in database: ${verifyResult.rows[0].count}`);

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Error recreating database:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Confirm before proceeding
const args = process.argv.slice(2);
if (!args.includes('--confirm')) {
  console.log('⚠️  WARNING: This will DROP ALL TABLES and recreate from schema.sql');
  console.log('⚠️  ALL DATA WILL BE LOST!');
  console.log('\nTo proceed, run: npm run recreate-db -- --confirm\n');
  process.exit(0);
}

fixAndRecreate();

