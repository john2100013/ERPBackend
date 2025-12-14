/**
 * Drop all tables and recreate from Neon schema.sql
 * This ensures 100% match with Neon database structure
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function recreateDatabase() {
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

    console.log('\n📖 Reading schema.sql...');
    const schemaFile = path.join(__dirname, '../schema.sql');
    
    if (!fs.existsSync(schemaFile)) {
      console.error('❌ Error: schema.sql not found');
      console.error('Please run: npm run dump-neon-schema first');
      process.exit(1);
    }

    const schemaSQL = fs.readFileSync(schemaFile, 'utf8');
    
    // Execute the entire schema SQL as one transaction
    // This handles multi-line statements properly
    console.log('Executing schema.sql...\n');
    
    // Split by table creation blocks (each CREATE TABLE ... ; block)
    // We'll execute the entire file but handle errors per statement
    const lines = schemaSQL.split('\n');
    let currentStatement = '';
    let inStatement = false;
    const statements: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and standalone comments
      if (!trimmed || trimmed.startsWith('--')) {
        continue;
      }
      
      currentStatement += line + '\n';
      
      // Check if this line completes a statement
      if (trimmed.endsWith(';')) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
    }
    
    // Add any remaining statement
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    console.log('🔨 Creating tables from Neon schema...\n');

    await client.query('BEGIN');

    let created = 0;
    let errors = 0;

    for (const statement of statements) {
      try {
        // Skip empty statements and comments
        if (statement.length < 10 || statement.startsWith('--')) {
          continue;
        }

        // Execute statement
        await client.query(statement);
        
        // Extract table name if it's a CREATE TABLE statement
        const createMatch = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i);
        if (createMatch) {
          console.log(`  ✅ Created: ${createMatch[1]}`);
          created++;
        } else {
          // Check for ALTER TABLE, CREATE INDEX, etc.
          const alterMatch = statement.match(/ALTER TABLE (\w+)/i);
          const indexMatch = statement.match(/CREATE (?:UNIQUE )?INDEX.*ON (\w+)/i);
          if (alterMatch || indexMatch) {
            // Just count it, don't log every constraint/index
          }
        }
      } catch (error: any) {
        errors++;
        const errorCode = error.code;
        const errorMsg = error.message;
        
        // Some errors are expected (like duplicate constraints)
        if (errorCode === '42P07' || errorMsg.includes('already exists')) {
          // Table/index already exists - this is OK
          continue;
        }
        
        console.error(`  ❌ Error:`, errorMsg);
        console.error(`     Code: ${errorCode}`);
        console.error(`     Statement preview: ${statement.substring(0, 150).replace(/\n/g, ' ')}...`);
      }
    }

    await client.query('COMMIT');

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Database recreation complete!`);
    console.log(`   Tables created: ${created}`);
    console.log(`   Errors: ${errors}`);
    console.log('='.repeat(60));

    // Verify tables were created
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

recreateDatabase();

