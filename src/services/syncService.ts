import { Pool } from 'pg';
import { getLocalPool, getNeonPool } from '../database/connection';

interface SyncResult {
  success: boolean;
  message: string;
  syncedTables: string[];
  errors: string[];
  stats: {
    [tableName: string]: {
      inserted: number;
      updated: number;
      errors: number;
    };
  };
}

/**
 * Sync data from local PostgreSQL to Neon database
 * This function will:
 * 1. Get all data from local database tables
 * 2. Insert or update records in Neon database
 * 3. Handle conflicts by updating existing records
 */
export const syncLocalToNeon = async (): Promise<SyncResult> => {
  const result: SyncResult = {
    success: true,
    message: 'Sync completed successfully',
    syncedTables: [],
    errors: [],
    stats: {},
  };

  const localPool = getLocalPool();
  const neonPool = getNeonPool();

  // List of tables to sync (in order of dependencies)
  const tablesToSync = [
    'users',
    'businesses',
    'business_settings',
    'item_categories',
    'items',
    'customers',
    'financial_accounts',
    'quotations',
    'quotation_lines',
    'invoices',
    'invoice_lines',
    'goods_returns',
    'goods_return_lines',
    'damage_records',
    'damage_record_lines',
    // Hospital tables
    'patients',
    'consultations',
    'doctor_visits',
    'lab_tests',
    'prescriptions',
    'prescription_items',
    // Salon tables
    'salon_employees',
    'salon_services',
    'salon_products',
    'salon_shifts',
    'salon_invoices',
    'salon_invoice_items',
    // Service billing tables
    'service_billing_services',
    'service_billing_employees',
    'service_billing_customers',
    'service_billing_bookings',
    'service_billing_assignments',
    'service_billing_invoices',
    'service_billing_invoice_items',
    // M-Pesa tables
    'mpesa_confirmations',
  ];

  try {
    for (const tableName of tablesToSync) {
      try {
        // Check if table exists in both databases
        const localTableExists = await checkTableExists(localPool, tableName);
        const neonTableExists = await checkTableExists(neonPool, tableName);

        if (!localTableExists) {
          console.log(`Table ${tableName} does not exist in local database, skipping...`);
          continue;
        }

        if (!neonTableExists) {
          console.log(`Table ${tableName} does not exist in Neon database, skipping...`);
          continue;
        }

        // Get primary key column(s) for the table
        const primaryKeys = await getPrimaryKeys(localPool, tableName);
        
        if (primaryKeys.length === 0) {
          console.log(`Table ${tableName} has no primary key, skipping...`);
          continue;
        }

        // Get common columns that exist in both databases
        const commonColumns = await getCommonColumns(localPool, neonPool, tableName);
        
        console.log(`\n📋 Table: ${tableName}`);
        console.log(`   Common columns (${commonColumns.length}): ${commonColumns.join(', ')}`);
        
        if (commonColumns.length === 0) {
          console.log(`   ⚠️  Table ${tableName} has no common columns, skipping...`);
          continue;
        }

        // Ensure primary keys are in common columns (they must exist in both)
        const validPrimaryKeys = primaryKeys.filter(key => commonColumns.includes(key));
        if (validPrimaryKeys.length === 0) {
          console.log(`   ⚠️  Table ${tableName} has no valid primary keys in common columns, skipping...`);
          continue;
        }
        
        console.log(`   Primary keys: ${validPrimaryKeys.join(', ')}`);

        // Build SELECT query with only common columns
        const selectColumns = commonColumns.join(', ');
        const localData = await localPool.query(`SELECT ${selectColumns} FROM ${tableName}`);
        
        if (localData.rows.length === 0) {
          console.log(`Table ${tableName} is empty in local database, skipping...`);
          result.stats[tableName] = { inserted: 0, updated: 0, errors: 0 };
          continue;
        }

        // Sync each row
        let inserted = 0;
        let updated = 0;
        let errors = 0;

        for (const row of localData.rows) {
          try {
            // Check if record exists in Neon database using valid primary keys
            const whereClause = validPrimaryKeys.map((key, idx) => `${key} = $${idx + 1}`).join(' AND ');
            const keyValues = validPrimaryKeys.map(key => row[key]);
            
            const existingRecord = await neonPool.query(
              `SELECT * FROM ${tableName} WHERE ${whereClause}`,
              keyValues
            );

            if (existingRecord.rows.length > 0) {
              // Update existing record - only update non-primary key columns that exist in both
              const updateColumns = commonColumns.filter(col => !validPrimaryKeys.includes(col));
              if (updateColumns.length > 0) {
                const setClause = updateColumns.map((col, idx) => `${col} = $${idx + 1}`).join(', ');
                const values = updateColumns.map(col => row[col]);
                const allValues = [...values, ...keyValues];

                await neonPool.query(
                  `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`,
                  allValues
                );
                updated++;
              }
            } else {
              // Insert new record - only insert columns that exist in both databases
              const insertColumns = commonColumns;
              const placeholders = insertColumns.map((_, idx) => `$${idx + 1}`).join(', ');
              const values = insertColumns.map(col => row[col]);

              console.log(`   🔄 Inserting row with ${insertColumns.length} columns: ${insertColumns.join(', ')}`);
              console.log(`   📊 Values: ${values.map((v, i) => `${insertColumns[i]}=${v}`).join(', ')}`);

              await neonPool.query(
                `INSERT INTO ${tableName} (${insertColumns.join(', ')}) VALUES (${placeholders})`,
                values
              );
              inserted++;
            }
          } catch (error: any) {
            errors++;
            const errorMsg = `Error syncing row in ${tableName}: ${error.message}`;
            console.error(`   ❌ ${errorMsg}`);
            console.error(`   📋 Columns attempted: ${commonColumns.join(', ')}`);
            console.error(`   📊 Column count: ${commonColumns.length}`);
            if (error.message.includes('parameters')) {
              const paramMatch = error.message.match(/(\d+) parameters/);
              if (paramMatch) {
                console.error(`   ⚠️  Parameter mismatch detected! Expected different column count.`);
              }
            }
            result.errors.push(errorMsg);
          }
        }

        result.stats[tableName] = { inserted, updated, errors };
        result.syncedTables.push(tableName);
        console.log(`Synced ${tableName}: ${inserted} inserted, ${updated} updated, ${errors} errors`);

      } catch (error: any) {
        const errorMsg = `Error syncing table ${tableName}: ${error.message}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
        result.stats[tableName] = { inserted: 0, updated: 0, errors: 1 };
      }
    }

    if (result.errors.length > 0) {
      result.success = false;
      result.message = `Sync completed with ${result.errors.length} error(s)`;
    }

    return result;
  } catch (error: any) {
    result.success = false;
    result.message = `Sync failed: ${error.message}`;
    result.errors.push(error.message);
    return result;
  }
};

/**
 * Check if a table exists in the database
 */
const checkTableExists = async (pool: Pool, tableName: string): Promise<boolean> => {
  try {
    const result = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      [tableName]
    );
    return result.rows[0].exists;
  } catch (error) {
    console.error(`Error checking table existence for ${tableName}:`, error);
    return false;
  }
};

/**
 * Get primary key columns for a table
 */
const getPrimaryKeys = async (pool: Pool, tableName: string): Promise<string[]> => {
  try {
    const result = await pool.query(
      `SELECT a.attname
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
       JOIN pg_class c ON c.oid = i.indrelid
       WHERE c.relname = $1
       AND i.indisprimary`,
      [tableName]
    );
    if (result.rows.length > 0) {
      return result.rows.map(row => row.attname);
    }
    // Fallback: try to use 'id' as primary key
    return ['id'];
  } catch (error) {
    console.error(`Error getting primary keys for ${tableName}:`, error);
    // Fallback: try to use 'id' as primary key
    return ['id'];
  }
};

/**
 * Get columns that exist in both databases for a table
 */
const getCommonColumns = async (
  localPool: Pool,
  neonPool: Pool,
  tableName: string
): Promise<string[]> => {
  try {
    // Get columns from local database
    const localResult = await localPool.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_schema = 'public' 
       AND table_name = $1
       ORDER BY ordinal_position`,
      [tableName]
    );
    const localColumns = localResult.rows.map(row => row.column_name);

    // Get columns from Neon database
    const neonResult = await neonPool.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_schema = 'public' 
       AND table_name = $1
       ORDER BY ordinal_position`,
      [tableName]
    );
    const neonColumns = neonResult.rows.map(row => row.column_name);

    // Return only columns that exist in both databases
    const commonColumns = localColumns.filter(col => neonColumns.includes(col));
    
    // Log differences for debugging
    const onlyLocal = localColumns.filter(col => !neonColumns.includes(col));
    const onlyNeon = neonColumns.filter(col => !localColumns.includes(col));
    
    if (onlyLocal.length > 0) {
      console.log(`   ⚠️  Columns only in local: ${onlyLocal.join(', ')}`);
    }
    if (onlyNeon.length > 0) {
      console.log(`   ⚠️  Columns only in Neon: ${onlyNeon.join(', ')}`);
    }
    
    return commonColumns;
  } catch (error) {
    console.error(`Error getting common columns for ${tableName}:`, error);
    return [];
  }
};

/**
 * Sync specific table from local to Neon
 */
export const syncTable = async (tableName: string): Promise<{
  success: boolean;
  message: string;
  inserted: number;
  updated: number;
  errors: number;
}> => {
  const localPool = getLocalPool();
  const neonPool = getNeonPool();

  try {
    // Check if table exists
    const localTableExists = await checkTableExists(localPool, tableName);
    const neonTableExists = await checkTableExists(neonPool, tableName);

    if (!localTableExists) {
      throw new Error(`Table ${tableName} does not exist in local database`);
    }

    if (!neonTableExists) {
      throw new Error(`Table ${tableName} does not exist in Neon database`);
    }

    // Get primary keys
    const primaryKeys = await getPrimaryKeys(localPool, tableName);
    if (primaryKeys.length === 0) {
      throw new Error(`Table ${tableName} has no primary key`);
    }

    // Get common columns that exist in both databases
    const commonColumns = await getCommonColumns(localPool, neonPool, tableName);
    if (commonColumns.length === 0) {
      throw new Error(`Table ${tableName} has no common columns`);
    }

    // Ensure primary keys are in common columns
    const validPrimaryKeys = primaryKeys.filter(key => commonColumns.includes(key));
    if (validPrimaryKeys.length === 0) {
      throw new Error(`Table ${tableName} has no valid primary keys in common columns`);
    }

    // Build SELECT query with only common columns
    const selectColumns = commonColumns.join(', ');
    const localData = await localPool.query(`SELECT ${selectColumns} FROM ${tableName}`);
    
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (const row of localData.rows) {
      try {
        const whereClause = validPrimaryKeys.map((key, idx) => `${key} = $${idx + 1}`).join(' AND ');
        const keyValues = validPrimaryKeys.map(key => row[key]);
        
        const existingRecord = await neonPool.query(
          `SELECT * FROM ${tableName} WHERE ${whereClause}`,
          keyValues
        );

        if (existingRecord.rows.length > 0) {
          // Update existing record - only update non-primary key columns that exist in both
          const updateColumns = commonColumns.filter(col => !validPrimaryKeys.includes(col));
          if (updateColumns.length > 0) {
            const setClause = updateColumns.map((col, idx) => `${col} = $${idx + 1}`).join(', ');
            const values = updateColumns.map(col => row[col]);
            const allValues = [...values, ...keyValues];

            await neonPool.query(
              `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`,
              allValues
            );
            updated++;
          }
        } else {
          // Insert new record - only insert columns that exist in both databases
          const insertColumns = commonColumns;
          const placeholders = insertColumns.map((_, idx) => `$${idx + 1}`).join(', ');
          const values = insertColumns.map(col => row[col]);

          await neonPool.query(
            `INSERT INTO ${tableName} (${insertColumns.join(', ')}) VALUES (${placeholders})`,
            values
          );
          inserted++;
        }
      } catch (error: any) {
        errors++;
        console.error(`Error syncing row in ${tableName}:`, error);
      }
    }

    return {
      success: errors === 0,
      message: `Synced ${tableName}: ${inserted} inserted, ${updated} updated, ${errors} errors`,
      inserted,
      updated,
      errors,
    };
  } catch (error: any) {
    throw new Error(`Failed to sync table ${tableName}: ${error.message}`);
  }
};

