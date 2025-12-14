/**
 * TypeScript script to dump Neon database schema
 * This uses pg library to query the schema and generate SQL
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

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

interface TableInfo {
  table_name: string;
  columns: TableColumn[];
  primary_keys: string[];
  foreign_keys: Array<{
    constraint_name: string;
    column_name: string;
    foreign_table: string;
    foreign_column: string;
  }>;
  indexes: Array<{
    index_name: string;
    column_name: string;
    is_unique: boolean;
  }>;
}

async function getTables(pool: Pool): Promise<string[]> {
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

async function getTableColumns(pool: Pool, tableName: string): Promise<TableColumn[]> {
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

async function getPrimaryKeys(pool: Pool, tableName: string): Promise<string[]> {
  const result = await pool.query(`
    SELECT a.attname
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    JOIN pg_class c ON c.oid = i.indrelid
    WHERE c.relname = $1
    AND i.indisprimary
  `, [tableName]);
  
  return result.rows.map(row => row.attname);
}

async function getForeignKeys(pool: Pool, tableName: string) {
  const result = await pool.query(`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = $1
      AND tc.table_schema = 'public'
  `, [tableName]);
  
  return result.rows.map(row => ({
    constraint_name: row.constraint_name,
    column_name: row.column_name,
    foreign_table: row.foreign_table_name,
    foreign_column: row.foreign_column_name,
  }));
}

async function getIndexes(pool: Pool, tableName: string) {
  const result = await pool.query(`
    SELECT
      i.relname AS index_name,
      a.attname AS column_name,
      ix.indisunique AS is_unique
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    WHERE t.relname = $1
      AND t.relkind = 'r'
      AND NOT ix.indisprimary
  `, [tableName]);
  
  return result.rows.map(row => ({
    index_name: row.index_name,
    column_name: row.column_name,
    is_unique: row.is_unique,
  }));
}

function generateColumnSQL(column: TableColumn): string {
  let sql = `  ${column.column_name} `;
  
  // Build data type
  if (column.data_type === 'character varying' || column.data_type === 'varchar') {
    sql += `VARCHAR(${column.character_maximum_length || 255})`;
  } else if (column.data_type === 'numeric' || column.data_type === 'decimal') {
    sql += `NUMERIC(${column.numeric_precision || 10}, ${column.numeric_scale || 0})`;
  } else if (column.data_type === 'timestamp without time zone') {
    sql += 'TIMESTAMP';
  } else if (column.data_type === 'timestamp with time zone') {
    sql += 'TIMESTAMP WITH TIME ZONE';
  } else if (column.data_type === 'boolean') {
    sql += 'BOOLEAN';
  } else if (column.data_type === 'integer') {
    sql += 'INTEGER';
  } else if (column.data_type === 'bigint') {
    sql += 'BIGINT';
  } else if (column.data_type === 'serial') {
    sql += 'SERIAL';
  } else if (column.data_type === 'bigserial') {
    sql += 'BIGSERIAL';
  } else if (column.data_type === 'double precision') {
    sql += 'DOUBLE PRECISION';
  } else if (column.data_type === 'text') {
    sql += 'TEXT';
  } else if (column.data_type === 'jsonb') {
    sql += 'JSONB';
  } else if (column.data_type === 'uuid') {
    sql += 'UUID';
  } else {
    sql += column.data_type.toUpperCase();
  }
  
  // Add nullable
  if (column.is_nullable === 'NO') {
    sql += ' NOT NULL';
  }
  
  // Add default if exists
  if (column.column_default) {
    let defaultValue = column.column_default;
    // Clean up default value
    if (defaultValue.includes('::')) {
      defaultValue = defaultValue.split('::')[0];
    }
    sql += ` DEFAULT ${defaultValue}`;
  }
  
  return sql;
}

function generateTableSQL(table: TableInfo): string {
  let sql = `\n-- Table: ${table.table_name}\n`;
  sql += `CREATE TABLE IF NOT EXISTS ${table.table_name} (\n`;
  
  // Add columns
  const columnSQLs = table.columns.map(col => generateColumnSQL(col));
  sql += columnSQLs.join(',\n');
  
  // Add primary key
  if (table.primary_keys.length > 0) {
    sql += `,\n  PRIMARY KEY (${table.primary_keys.join(', ')})`;
  }
  
  sql += '\n);\n';
  
  // Add foreign keys
  if (table.foreign_keys.length > 0) {
    sql += '\n';
    for (const fk of table.foreign_keys) {
      sql += `ALTER TABLE ${table.table_name} ADD CONSTRAINT ${fk.constraint_name} `;
      sql += `FOREIGN KEY (${fk.column_name}) REFERENCES ${fk.foreign_table}(${fk.foreign_column});\n`;
    }
  }
  
  // Add indexes
  if (table.indexes.length > 0) {
    sql += '\n';
    for (const idx of table.indexes) {
      const unique = idx.is_unique ? 'UNIQUE ' : '';
      sql += `CREATE ${unique}INDEX IF NOT EXISTS ${idx.index_name} ON ${table.table_name}(${idx.column_name});\n`;
    }
  }
  
  return sql;
}

async function dumpSchema() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL not found in .env file');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔍 Connecting to Neon database...');
    await pool.query('SELECT 1'); // Test connection
    
    console.log('📋 Fetching table list...');
    const tables = await getTables(pool);
    console.log(`Found ${tables.length} tables`);
    
    console.log('📊 Generating schema...');
    let schemaSQL = `-- Neon Database Schema Dump\n`;
    schemaSQL += `-- Generated: ${new Date().toISOString()}\n`;
    schemaSQL += `-- Total Tables: ${tables.length}\n\n`;
    
    const tableInfos: TableInfo[] = [];
    
    for (const tableName of tables) {
      console.log(`  Processing: ${tableName}`);
      const columns = await getTableColumns(pool, tableName);
      const primaryKeys = await getPrimaryKeys(pool, tableName);
      const foreignKeys = await getForeignKeys(pool, tableName);
      const indexes = await getIndexes(pool, tableName);
      
      tableInfos.push({
        table_name: tableName,
        columns,
        primary_keys: primaryKeys,
        foreign_keys: foreignKeys,
        indexes,
      });
    }
    
    // Generate SQL for each table
    for (const table of tableInfos) {
      schemaSQL += generateTableSQL(table);
      schemaSQL += '\n';
    }
    
    // Write to file
    const outputFile = path.join(__dirname, '../schema.sql');
    fs.writeFileSync(outputFile, schemaSQL, 'utf8');
    
    const stats = fs.statSync(outputFile);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    const lineCount = schemaSQL.split('\n').length;
    
    console.log('\n✅ Schema dumped successfully!');
    console.log(`📁 File: ${outputFile}`);
    console.log(`📊 Size: ${fileSizeInMB} MB`);
    console.log(`📝 Lines: ${lineCount}`);
    console.log(`📋 Tables: ${tables.length}`);
    
  } catch (error: any) {
    console.error('❌ Error dumping schema:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

dumpSchema();

