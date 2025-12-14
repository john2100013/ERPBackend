/**
 * Recreate database directly from Neon using pg_dump
 * This ensures we get the exact structure
 */

import { execSync } from 'child_process';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function recreateFromNeon() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL not found in .env file');
    process.exit(1);
  }

  const localPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Password',
    database: process.env.DB_NAME || 'awesomeinvoice',
  });

  const client = await localPool.connect();

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

    // Drop all tables
    for (const table of tables) {
      try {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`  ✅ Dropped: ${table}`);
      } catch (error: any) {
        console.error(`  ❌ Error dropping ${table}:`, error.message);
      }
    }

    console.log('\n📥 Fetching schema from Neon using pg_dump...\n');

    // Use pg_dump to get schema
    const schemaFile = path.join(__dirname, '../schema_fresh.sql');
    const dbUrl = process.env.DATABASE_URL;
    
    try {
      const command = `pg_dump --dbname="${dbUrl}" --schema-only --no-owner --no-privileges --file="${schemaFile}"`;
      console.log('Running pg_dump...');
      execSync(command, { stdio: 'inherit' });
      console.log('✅ Schema dumped successfully\n');
    } catch (error: any) {
      console.error('❌ Error running pg_dump:', error.message);
      console.error('Make sure pg_dump is installed and in your PATH');
      process.exit(1);
    }

    // Read and execute the schema
    console.log('🔨 Creating tables from Neon schema...\n');
    const schemaSQL = fs.readFileSync(schemaFile, 'utf8');

    // Extract only CREATE TABLE statements (ignore functions, triggers, etc.)
    const createTableRegex = /CREATE TABLE (?:IF NOT EXISTS )?([\w.]+)\s*\([^;]+\);/gs;
    const createTableStatements: string[] = [];
    let match;
    while ((match = createTableRegex.exec(schemaSQL)) !== null) {
      createTableStatements.push(match[0].trim());
    }
    
    // Also extract ALTER TABLE statements for constraints
    const alterTableRegex = /ALTER TABLE[^;]+;/gs;
    const alterTableStatements = schemaSQL.match(alterTableRegex) || [];
    
    // Extract CREATE SEQUENCE statements
    const createSequenceRegex = /CREATE SEQUENCE[^;]+;/gs;
    const createSequenceStatements = schemaSQL.match(createSequenceRegex) || [];
    
    // Extract CREATE INDEX statements
    const createIndexRegex = /CREATE (?:UNIQUE )?INDEX[^;]+;/gs;
    const createIndexStatements = schemaSQL.match(createIndexRegex) || [];
    
    console.log(`Found: ${createSequenceStatements.length} sequences, ${createTableStatements.length} tables, ${alterTableStatements.length} constraints, ${createIndexStatements.length} indexes\n`);

    let created = 0;
    let errors = 0;

    // Execute sequences first
    for (const statement of createSequenceStatements) {
      try {
        await client.query(statement.trim());
        const seqMatch = statement.match(/CREATE SEQUENCE (?:IF NOT EXISTS )?([\w.]+)/i);
        if (seqMatch) {
          console.log(`  ✅ Sequence: ${seqMatch[1]}`);
        }
      } catch (error: any) {
        if (error.code !== '42P07' && !error.message.includes('already exists')) {
          errors++;
          console.error(`  ⚠️  Sequence error: ${error.message.substring(0, 80)}`);
        }
      }
    }

    // Execute CREATE TABLE statements
    for (const statement of createTableStatements) {
      try {
        await client.query(statement);
        const tableMatch = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?([\w.]+)/i);
        if (tableMatch) {
          const tableName = tableMatch[1].replace(/^public\./, '');
          console.log(`  ✅ Table: ${tableName}`);
          created++;
        }
      } catch (error: any) {
        errors++;
        const errorCode = error.code;
        
        // Ignore "already exists" errors
        if (errorCode === '42P07' || error.message.includes('already exists')) {
          continue;
        }
        
        console.error(`  ⚠️  Table error: ${error.message.substring(0, 100)}`);
      }
    }

    // Execute ALTER TABLE constraints
    for (const statement of alterTableStatements) {
      try {
        await client.query(statement.trim());
      } catch (error: any) {
        if (error.code !== '42P07' && !error.message.includes('already exists') && !error.message.includes('does not exist')) {
          errors++;
          // Don't log every constraint error, too verbose
        }
      }
    }

    // Execute CREATE INDEX statements
    for (const statement of createIndexStatements) {
      try {
        await client.query(statement.trim());
      } catch (error: any) {
        if (error.code !== '42P07' && !error.message.includes('already exists')) {
          // Index errors are usually not critical
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Database recreation complete!`);
    console.log(`   Tables created: ${created}`);
    console.log(`   Errors: ${errors}`);
    console.log('='.repeat(60));

    // Verify
    const verifyResult = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_tables 
      WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
    `);

    console.log(`\n📊 Total tables in database: ${verifyResult.rows[0].count}`);

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await localPool.end();
  }
}

// Confirm
const args = process.argv.slice(2);
const hasConfirm = args.includes('--confirm') || args.includes('confirm') || process.env.FORCE_RECREATE === 'true';
if (!hasConfirm) {
  console.log('⚠️  WARNING: This will DROP ALL TABLES and recreate from Neon');
  console.log('⚠️  ALL DATA WILL BE LOST!');
  console.log('\nTo proceed, run: npm run recreate-db -- --confirm\n');
  process.exit(0);
}

recreateFromNeon();

