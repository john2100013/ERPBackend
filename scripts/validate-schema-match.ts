/**
 * Comprehensive schema validation script
 * Compares local database with Neon schema.sql to ensure 100% match
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { getLocalPool } from '../src/database/connection';

dotenv.config();

interface ColumnInfo {
  column_name: string;
  data_type: string;
  character_maximum_length: number | null;
  is_nullable: string;
  column_default: string | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
}

interface TableValidation {
  table_name: string;
  exists: boolean;
  columns_match: boolean;
  missing_columns: string[];
  extra_columns: string[];
  type_mismatches: Array<{
    column: string;
    neon_type: string;
    local_type: string;
  }>;
  nullable_mismatches: Array<{
    column: string;
    neon_nullable: string;
    local_nullable: string;
  }>;
}

async function getLocalTableColumns(pool: Pool, tableName: string): Promise<ColumnInfo[]> {
  const result = await pool.query(`
    SELECT 
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

function normalizeDataType(col: ColumnInfo): string {
  let type = col.data_type.toLowerCase();
  
  if (type === 'character varying' || type === 'varchar') {
    return `varchar(${col.character_maximum_length || 255})`;
  }
  if (type === 'numeric' || type === 'decimal') {
    return `numeric(${col.numeric_precision || 10}, ${col.numeric_scale || 0})`;
  }
  if (type === 'timestamp without time zone') {
    return 'timestamp';
  }
  if (type === 'timestamp with time zone') {
    return 'timestamp with time zone';
  }
  
  return type;
}

function parseSchemaSQL(schemaSQL: string): Map<string, Map<string, ColumnInfo>> {
  const tableColumns = new Map<string, Map<string, ColumnInfo>>();
  
  const createTableRegex = /CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\);/g;
  let match;
  
  while ((match = createTableRegex.exec(schemaSQL)) !== null) {
    const tableName = match[1];
    const columnsBlock = match[2];
    const columns = new Map<string, ColumnInfo>();
    
    // Parse each column line
    const lines = columnsBlock.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('PRIMARY KEY'));
    
    for (const line of lines) {
      // Match: column_name TYPE [NOT NULL] [DEFAULT value]
      const columnMatch = line.match(/^\s*(\w+)\s+([A-Z_]+(?:\([^)]+\))?)\s*(NOT NULL)?\s*(DEFAULT\s+[^,]+)?/i);
      
      if (columnMatch) {
        const columnName = columnMatch[1];
        let dataType = columnMatch[2].toLowerCase();
        const isNullable = !columnMatch[3];
        const defaultValue = columnMatch[4] ? columnMatch[4].replace(/^DEFAULT\s+/i, '') : null;
        
        // Parse type details
        let charMaxLength: number | null = null;
        let numericPrecision: number | null = null;
        let numericScale: number | null = null;
        
        if (dataType.startsWith('varchar(')) {
          const match = dataType.match(/varchar\((\d+)\)/);
          if (match) {
            charMaxLength = parseInt(match[1]);
            dataType = 'character varying';
          }
        } else if (dataType.startsWith('numeric(')) {
          const match = dataType.match(/numeric\((\d+)(?:,\s*(\d+))?\)/);
          if (match) {
            numericPrecision = parseInt(match[1]);
            numericScale = match[2] ? parseInt(match[2]) : 0;
            dataType = 'numeric';
          }
        }
        
        columns.set(columnName, {
          column_name: columnName,
          data_type: dataType,
          character_maximum_length: charMaxLength,
          is_nullable: isNullable ? 'YES' : 'NO',
          column_default: defaultValue,
          numeric_precision: numericPrecision,
          numeric_scale: numericScale,
        });
      }
    }
    
    tableColumns.set(tableName, columns);
  }
  
  return tableColumns;
}

async function validateAllTables() {
  const schemaFile = path.join(__dirname, '../schema.sql');
  
  if (!fs.existsSync(schemaFile)) {
    console.error('❌ Error: schema.sql not found');
    console.error('Please run: npm run dump-neon-schema first');
    process.exit(1);
  }
  
  console.log('📖 Reading schema.sql...');
  const schemaSQL = fs.readFileSync(schemaFile, 'utf8');
  
  console.log('🔍 Parsing Neon schema...');
  const neonTables = parseSchemaSQL(schemaSQL);
  console.log(`Found ${neonTables.size} tables in Neon schema\n`);
  
  const localPool = getLocalPool();
  
  try {
    console.log('📋 Fetching local database structure...');
    const localTables = await getLocalTables(localPool);
    console.log(`Found ${localTables.length} tables in local database\n`);
    
    const validations: TableValidation[] = [];
    let totalIssues = 0;
    
    console.log('🔍 Validating each table...\n');
    console.log('='.repeat(80));
    
    // Validate each Neon table
    for (const [tableName, neonColumns] of neonTables) {
      const validation: TableValidation = {
        table_name: tableName,
        exists: false,
        columns_match: true,
        missing_columns: [],
        extra_columns: [],
        type_mismatches: [],
        nullable_mismatches: [],
      };
      
      if (!localTables.includes(tableName)) {
        validation.exists = false;
        validation.columns_match = false;
        console.log(`❌ ${tableName}: TABLE MISSING in local database`);
        totalIssues++;
        validations.push(validation);
        continue;
      }
      
      validation.exists = true;
      
      // Get local columns
      const localColumnsData = await getLocalTableColumns(localPool, tableName);
      const localColumns = new Map(localColumnsData.map(col => [col.column_name, col]));
      
      // Check each Neon column
      for (const [columnName, neonColumn] of neonColumns) {
        if (!localColumns.has(columnName)) {
          validation.missing_columns.push(columnName);
          validation.columns_match = false;
        } else {
          const localColumn = localColumns.get(columnName)!;
          
          // Check type
          const neonType = normalizeDataType(neonColumn);
          const localType = normalizeDataType(localColumn);
          
          if (neonType !== localType) {
            validation.type_mismatches.push({
              column: columnName,
              neon_type: neonType,
              local_type: localType,
            });
            validation.columns_match = false;
          }
          
          // Check nullable
          if (neonColumn.is_nullable !== localColumn.is_nullable) {
            validation.nullable_mismatches.push({
              column: columnName,
              neon_nullable: neonColumn.is_nullable,
              local_nullable: localColumn.is_nullable,
            });
            validation.columns_match = false;
          }
        }
      }
      
      // Check for extra columns in local
      for (const [columnName, localColumn] of localColumns) {
        if (!neonColumns.has(columnName)) {
          validation.extra_columns.push(columnName);
          validation.columns_match = false;
        }
      }
      
      if (!validation.columns_match) {
        totalIssues++;
        console.log(`\n⚠️  ${tableName}:`);
        if (validation.missing_columns.length > 0) {
          console.log(`   Missing columns: ${validation.missing_columns.join(', ')}`);
        }
        if (validation.extra_columns.length > 0) {
          console.log(`   Extra columns: ${validation.extra_columns.join(', ')}`);
        }
        if (validation.type_mismatches.length > 0) {
          console.log(`   Type mismatches:`);
          validation.type_mismatches.forEach(m => {
            console.log(`     - ${m.column}: Neon=${m.neon_type}, Local=${m.local_type}`);
          });
        }
        if (validation.nullable_mismatches.length > 0) {
          console.log(`   Nullable mismatches:`);
          validation.nullable_mismatches.forEach(m => {
            console.log(`     - ${m.column}: Neon=${m.neon_nullable}, Local=${m.local_nullable}`);
          });
        }
      } else {
        console.log(`✅ ${tableName}: OK`);
      }
      
      validations.push(validation);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 Validation Summary:');
    console.log(`   Total tables checked: ${validations.length}`);
    console.log(`   Tables matching: ${validations.filter(v => v.columns_match && v.exists).length}`);
    console.log(`   Tables with issues: ${totalIssues}`);
    
    if (totalIssues === 0) {
      console.log('\n✅ All tables match Neon schema perfectly!');
    } else {
      console.log('\n⚠️  Some tables need updates. Run: npm run sync-from-schema');
    }
    
    // Generate migration SQL for any issues
    const migrationSQL: string[] = [];
    
    for (const validation of validations) {
      if (!validation.exists) {
        migrationSQL.push(`-- Table ${validation.table_name} is missing. See schema.sql for CREATE TABLE statement.`);
        continue;
      }
      
      if (validation.missing_columns.length > 0) {
        // Note: We can't easily generate ADD COLUMN without full type info from schema.sql
        migrationSQL.push(`-- Table ${validation.table_name} missing columns: ${validation.missing_columns.join(', ')}`);
      }
      
      if (validation.extra_columns.length > 0) {
        for (const col of validation.extra_columns) {
          migrationSQL.push(`ALTER TABLE ${validation.table_name} DROP COLUMN IF EXISTS ${col};`);
        }
      }
    }
    
    if (migrationSQL.length > 0) {
      const migrationFile = path.join(__dirname, '../migrations/027_fix_schema_mismatches.sql');
      const fullMigration = `-- Migration: Fix schema mismatches
-- Generated: ${new Date().toISOString()}
-- Based on comprehensive schema validation

${migrationSQL.join('\n\n')}
`;
      fs.writeFileSync(migrationFile, fullMigration, 'utf8');
      console.log(`\n💾 Generated migration: ${migrationFile}`);
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await localPool.end();
  }
}

validateAllTables();

