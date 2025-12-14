import { Pool } from 'pg';
import { getLocalPool, getNeonPool } from './connection';

interface ColumnInfo {
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
  columns: ColumnInfo[];
}

/**
 * Get all tables from a database
 */
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

/**
 * Get column information for a table
 */
async function getTableColumns(pool: Pool, tableName: string): Promise<ColumnInfo[]> {
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

/**
 * Get full table structure
 */
async function getTableStructure(pool: Pool, tableName: string): Promise<TableInfo> {
  const columns = await getTableColumns(pool, tableName);
  return {
    table_name: tableName,
    columns,
  };
}

/**
 * Compare two column definitions
 */
function columnsMatch(col1: ColumnInfo, col2: ColumnInfo): boolean {
  // Compare basic properties
  if (col1.column_name !== col2.column_name) return false;
  if (col1.data_type !== col2.data_type) return false;
  if (col1.is_nullable !== col2.is_nullable) return false;
  
  // Compare character length
  if (col1.character_maximum_length !== col2.character_maximum_length) return false;
  
  // Compare numeric precision
  if (col1.numeric_precision !== col2.numeric_precision) return false;
  if (col1.numeric_scale !== col2.numeric_scale) return false;
  
  // Note: We don't compare defaults as they might differ but still be compatible
  
  return true;
}

/**
 * Generate SQL to add a column
 */
function generateAddColumnSQL(tableName: string, column: ColumnInfo): string {
  let sql = `ALTER TABLE ${tableName} ADD COLUMN ${column.column_name} `;
  
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
    // Clean up default value (remove ::type casting)
    let defaultValue = column.column_default;
    if (defaultValue.includes('::')) {
      defaultValue = defaultValue.split('::')[0];
    }
    sql += ` DEFAULT ${defaultValue}`;
  }
  
  return sql;
}

/**
 * Generate SQL to drop a column
 */
function generateDropColumnSQL(tableName: string, columnName: string): string {
  return `ALTER TABLE ${tableName} DROP COLUMN IF EXISTS ${columnName}`;
}

/**
 * Generate SQL to modify a column
 */
function generateModifyColumnSQL(tableName: string, neonColumn: ColumnInfo, localColumn: ColumnInfo): string {
  // For now, we'll drop and recreate if types differ significantly
  // This is safer than trying to ALTER COLUMN which can be complex
  const dropSQL = generateDropColumnSQL(tableName, neonColumn.column_name);
  const addSQL = generateAddColumnSQL(tableName, neonColumn);
  return `${dropSQL};\n${addSQL}`;
}

/**
 * Compare schemas and generate sync SQL
 */
export async function compareAndSyncSchemas(): Promise<{
  differences: Array<{
    table: string;
    action: 'add_column' | 'drop_column' | 'modify_column' | 'add_table' | 'drop_table';
    column?: string;
    sql: string;
  }>;
  syncSQL: string;
}> {
  const localPool = getLocalPool();
  const neonPool = getNeonPool();
  
  const differences: Array<{
    table: string;
    action: 'add_column' | 'drop_column' | 'modify_column' | 'add_table' | 'drop_table';
    column?: string;
    sql: string;
  }> = [];
  
  try {
    // Get all tables from both databases
    const localTables = await getTables(localPool);
    const neonTables = await getTables(neonPool);
    
    // Find tables that exist in Neon but not in local
    const missingTables = neonTables.filter(table => !localTables.includes(table));
    for (const table of missingTables) {
      differences.push({
        table,
        action: 'add_table',
        sql: `-- Table ${table} exists in Neon but not in local. Manual migration needed.`,
      });
    }
    
    // Find tables that exist in local but not in Neon (we'll skip these for now)
    const extraTables = localTables.filter(table => !neonTables.includes(table));
    for (const table of extraTables) {
      console.log(`⚠️  Table ${table} exists in local but not in Neon - skipping`);
    }
    
    // Compare tables that exist in both
    const commonTables = neonTables.filter(table => localTables.includes(table));
    
    for (const tableName of commonTables) {
      const neonStructure = await getTableStructure(neonPool, tableName);
      const localStructure = await getTableStructure(localPool, tableName);
      
      const neonColumns = new Map(neonStructure.columns.map(col => [col.column_name, col]));
      const localColumns = new Map(localStructure.columns.map(col => [col.column_name, col]));
      
      // Find columns in Neon that are missing in local
      for (const [columnName, neonColumn] of neonColumns) {
        if (!localColumns.has(columnName)) {
          const sql = generateAddColumnSQL(tableName, neonColumn);
          differences.push({
            table: tableName,
            action: 'add_column',
            column: columnName,
            sql,
          });
        } else {
          // Column exists, check if it matches
          const localColumn = localColumns.get(columnName)!;
          if (!columnsMatch(neonColumn, localColumn)) {
            const sql = generateModifyColumnSQL(tableName, neonColumn, localColumn);
            differences.push({
              table: tableName,
              action: 'modify_column',
              column: columnName,
              sql,
            });
          }
        }
      }
      
      // Find columns in local that don't exist in Neon (drop them)
      for (const [columnName, localColumn] of localColumns) {
        if (!neonColumns.has(columnName)) {
          const sql = generateDropColumnSQL(tableName, columnName);
          differences.push({
            table: tableName,
            action: 'drop_column',
            column: columnName,
            sql,
          });
        }
      }
    }
    
    // Generate complete SQL script
    const syncSQL = differences
      .filter(diff => diff.action !== 'add_table') // Skip table creation for now
      .map(diff => diff.sql)
      .join(';\n\n');
    
    return { differences, syncSQL };
  } catch (error) {
    console.error('Error comparing schemas:', error);
    throw error;
  }
}

/**
 * Apply schema sync to local database
 */
export async function applySchemaSync(dryRun: boolean = true): Promise<void> {
  const { differences, syncSQL } = await compareAndSyncSchemas();
  
  console.log('\n📊 Schema Comparison Results:');
  console.log('=' .repeat(60));
  
  if (differences.length === 0) {
    console.log('✅ Schemas match perfectly!');
    return;
  }
  
  console.log(`\nFound ${differences.length} difference(s):\n`);
  
  // Group by action
  const byAction = {
    add_column: differences.filter(d => d.action === 'add_column'),
    drop_column: differences.filter(d => d.action === 'drop_column'),
    modify_column: differences.filter(d => d.action === 'modify_column'),
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
  
  if (byAction.modify_column.length > 0) {
    console.log(`\n🔄 Columns to MODIFY (${byAction.modify_column.length}):`);
    byAction.modify_column.forEach(diff => {
      console.log(`  - ${diff.table}.${diff.column}`);
    });
  }
  
  if (byAction.add_table.length > 0) {
    console.log(`\n📋 Tables to CREATE (${byAction.add_table.length}):`);
    byAction.add_table.forEach(diff => {
      console.log(`  - ${diff.table}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📝 Generated SQL:\n');
  console.log(syncSQL);
  
  if (dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes applied');
    console.log('Run with dryRun=false to apply changes');
  } else {
    console.log('\n🚀 Applying changes to local database...');
    const localPool = getLocalPool();
    const client = await localPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Execute each SQL statement
      const statements = syncSQL.split(';\n\n').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim() && !statement.trim().startsWith('--')) {
          await client.query(statement);
          console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
        }
      }
      
      await client.query('COMMIT');
      console.log('\n✅ Schema sync completed successfully!');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('\n❌ Error applying schema sync:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

