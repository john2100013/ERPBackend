import pool from './connection';

export const updateTables = async (): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Add status column to businesses table if it doesn't exist
    await client.query(`
      ALTER TABLE businesses 
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' 
      CHECK (status IN ('active', 'inactive', 'suspended'))
    `);

    // Add status column to users table if it doesn't exist
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' 
      CHECK (status IN ('active', 'inactive', 'suspended'))
    `);

    // Check if users table needs password column rename
    const usersColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
    `);
    
    const userColumnNames = usersColumns.rows.map(row => row.column_name);
    
    if (!userColumnNames.includes('password_hash') && userColumnNames.includes('password')) {
      await client.query(`ALTER TABLE users RENAME COLUMN password TO password_hash`);
    } else if (!userColumnNames.includes('password_hash')) {
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`);
    }

    // Check if items table needs to be updated
    const itemsColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'items' AND table_schema = 'public'
    `);
    
    const columnNames = itemsColumns.rows.map(row => row.column_name);
    
    // Update items table structure if needed
    if (!columnNames.includes('item_name')) {
      await client.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS item_name VARCHAR(255)`);
      await client.query(`UPDATE items SET item_name = description WHERE item_name IS NULL`);
      await client.query(`ALTER TABLE items ALTER COLUMN item_name SET NOT NULL`);
    }
    
    if (!columnNames.includes('rate')) {
      await client.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS rate DECIMAL(12,2)`);
      await client.query(`UPDATE items SET rate = unit_price WHERE rate IS NULL`);
      await client.query(`ALTER TABLE items ALTER COLUMN rate SET NOT NULL`);
    }
    
    if (!columnNames.includes('unit')) {
      await client.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS unit VARCHAR(50)`);
      await client.query(`UPDATE items SET unit = uom WHERE unit IS NULL`);
    }
    
    if (!columnNames.includes('quantity')) {
      await client.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0`);
      await client.query(`UPDATE items SET quantity = stock_quantity WHERE quantity IS NULL`);
    }
    
    if (!columnNames.includes('amount')) {
      await client.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS amount DECIMAL(12,2)`);
      await client.query(`UPDATE items SET amount = quantity * rate WHERE amount IS NULL`);
    }

    await client.query('COMMIT');
    console.log('Database tables updated successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating tables:', error);
    throw error;
  } finally {
    client.release();
  }
};