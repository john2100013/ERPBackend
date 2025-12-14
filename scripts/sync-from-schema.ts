/**
 * Script to sync local database structure with schema.sql (from Neon)
 * This reads the schema.sql file and applies it to local database
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { getLocalPool } from '../src/database/connection';

dotenv.config();

interface TableColumn {
  table_name: string;
  column_name: string;
  data_type: string;
  character_maximum_length: number | null;
  is_nullable: string;
  column_default: string | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
}

async function getLocalTableColumns(pool: Pool, tableName: string): Promise<TableColumn[]> {
  const result = await pool.query(`
    SELECT 
      table_name,
      column_name,
      data_type,
      character_maximum_length,
      is_nullable,
      column_default,
      numeric_precision,
      numeric_scale
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);
  
  return result.rows;
}

async function getLocalTables(pool: Pool): Promise<string[]> {
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'pg_%'
    AND table_name NOT LIKE '_prisma%'
    ORDER BY table_name
  `);
  return result.rows.map(row => row.table_name);
}

function parseSchemaSQL(schemaSQL: string): Map<string, Set<string>> {
  // Parse CREATE TABLE statements to extract table and column names
  const tableColumns = new Map<string, Set<string>>();
  
  const createTableRegex = /CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\);/g;
  let match;
  
  while ((match = createTableRegex.exec(schemaSQL)) !== null) {
    const tableName = match[1];
    const columnsBlock = match[2];
    const columns = new Set<string>();
    
    // Extract column names (before the data type)
    const columnRegex = /^\s*(\w+)\s+/gm;
    let colMatch;
    
    while ((colMatch = columnRegex.exec(columnsBlock)) !== null) {
      const columnName = colMatch[1];
      // Skip PRIMARY KEY, FOREIGN KEY, etc.
      if (!['PRIMARY', 'FOREIGN', 'CONSTRAINT', 'UNIQUE'].includes(columnName.toUpperCase())) {
        columns.add(columnName);
      }
    }
    
    tableColumns.set(tableName, columns);
  }
  
  return tableColumns;
}

async function syncFromSchema(dryRun: boolean = true) {
  const schemaFile = path.join(__dirname, '../schema.sql');
  
  if (!fs.existsSync(schemaFile)) {
    console.error('❌ Error: schema.sql not found');
    console.error('Please run: npm run dump-neon-schema first');
    process.exit(1);
  }
  
  console.log('📖 Reading schema.sql...');
  const schemaSQL = fs.readFileSync(schemaFile, 'utf8');
  
  console.log('🔍 Parsing schema...');
  const neonTables = parseSchemaSQL(schemaSQL);
  console.log(`Found ${neonTables.size} tables in schema.sql`);
  
  const localPool = getLocalPool();
  
  try {
    console.log('📋 Fetching local database structure...');
    const localTables = await getLocalTables(localPool);
    console.log(`Found ${localTables.length} tables in local database`);
    
    const differences: Array<{
      table: string;
      action: 'add_column' | 'drop_column' | 'add_table';
      column?: string;
      sql: string;
    }> = [];
    
    // Check each Neon table
    for (const [tableName, neonColumns] of neonTables) {
      if (!localTables.includes(tableName)) {
        differences.push({
          table: tableName,
          action: 'add_table',
          sql: `-- Table ${tableName} exists in Neon but not in local. See schema.sql for CREATE TABLE statement.`,
        });
        continue;
      }
      
      // Get local columns
      const localColumnsData = await getLocalTableColumns(localPool, tableName);
      const localColumns = new Set(localColumnsData.map(col => col.column_name));
      
      // Find missing columns
      for (const neonColumn of neonColumns) {
        if (!localColumns.has(neonColumn)) {
          // Try to find column definition in schema.sql
          const columnRegex = new RegExp(`\\s+${neonColumn}\\s+([^,]+?)(?:,|\\n|$)`, 'i');
          const columnMatch = schemaSQL.match(columnRegex);
          
          if (columnMatch) {
            const columnDef = columnMatch[1].trim();
            differences.push({
              table: tableName,
              action: 'add_column',
              column: neonColumn,
              sql: `ALTER TABLE ${tableName} ADD COLUMN ${neonColumn} ${columnDef};`,
            });
          }
        }
      }
      
      // Find extra columns (in local but not in Neon)
      for (const localColumn of localColumns) {
        if (!neonColumns.has(localColumn)) {
          differences.push({
            table: tableName,
            action: 'drop_column',
            column: localColumn,
            sql: `ALTER TABLE ${tableName} DROP COLUMN IF EXISTS ${localColumn};`,
          });
        }
      }
    }
    
    // Report differences
    console.log('\n📊 Schema Comparison Results:');
    console.log('='.repeat(60));
    
    if (differences.length === 0) {
      console.log('✅ Local database matches Neon schema perfectly!');
      return;
    }
    
    console.log(`\nFound ${differences.length} difference(s):\n`);
    
    const byAction = {
      add_column: differences.filter(d => d.action === 'add_column'),
      drop_column: differences.filter(d => d.action === 'drop_column'),
      add_table: differences.filter(d => d.action === 'add_table'),
    };
    
    if (byAction.add_column.length > 0) {
      console.log(`\n➕ Columns to ADD (${byAction.add_column.length}):`);
      byAction.add_column.forEach(diff => {
        console.log(`  - ${diff.table}.${diff.column}`);
      });
    }
    
    if (byAction.drop_column.length > 0) {
      console.log(`\n➖ Columns to DROP (${byAction.drop_column.length}):`);
      byAction.drop_column.forEach(diff => {
        console.log(`  - ${diff.table}.${diff.column}`);
      });
    }
    
    if (byAction.add_table.length > 0) {
      console.log(`\n📋 Tables to CREATE (${byAction.add_table.length}):`);
      byAction.add_table.forEach(diff => {
        console.log(`  - ${diff.table}`);
      });
    }
    
    // Generate migration SQL
    const migrationSQL = differences
      .filter(diff => diff.action !== 'add_table') // Skip table creation for now
      .map(diff => diff.sql)
      .join('\n\n');
    
    if (migrationSQL) {
      console.log('\n' + '='.repeat(60));
      console.log('\n📝 Generated Migration SQL:\n');
      console.log(migrationSQL);
      
      // Save to file
      const migrationFile = path.join(__dirname, '../migrations/026_sync_from_neon_schema.sql');
      const fullMigration = `-- Migration: Sync local database with Neon schema
-- Generated: ${new Date().toISOString()}
-- Based on schema.sql from Neon database

${migrationSQL}
`;
      fs.writeFileSync(migrationFile, fullMigration, 'utf8');
      console.log(`\n💾 Saved to: ${migrationFile}`);
    }
    
    if (dryRun) {
      console.log('\n⚠️  DRY RUN MODE - No changes applied');
      console.log('Run with --apply to apply changes or run: npm run migrate');
    } else {
      console.log('\n🚀 Applying changes...');
      const client = await localPool.connect();
      
      try {
        await client.query('BEGIN');
        
        const statements = migrationSQL.split(';\n\n').filter(s => s.trim());
        for (const statement of statements) {
          if (statement.trim() && !statement.trim().startsWith('--')) {
            await client.query(statement);
            console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
          }
        }
        
        await client.query('COMMIT');
        console.log('\n✅ Schema sync completed successfully!');
      } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('\n❌ Error applying schema sync:', error.message);
        throw error;
      } finally {
        client.release();
      }
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await localPool.end();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = !args.includes('--apply');

syncFromSchema(dryRun);

