import { pool } from './src/database/connection';

async function checkItems() {
  try {
    console.log('🔍 Checking items in database...');
    
    // Check if items table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'items'
      );
    `);
    
    console.log('📊 Items table exists:', tableExists.rows[0].exists);
    
    if (tableExists.rows[0].exists) {
      // Get table structure
      const structure = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'items' 
        ORDER BY ordinal_position;
      `);
      
      console.log('📋 Items table structure:');
      structure.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
      
      // Count total items
      const count = await pool.query('SELECT COUNT(*) FROM items');
      console.log(`📊 Total items in database: ${count.rows[0].count}`);
      
      // Get sample items
      const sample = await pool.query('SELECT * FROM items LIMIT 5');
      console.log('📦 Sample items:');
      sample.rows.forEach((item, index) => {
        console.log(`  ${index + 1}.`, item);
      });
      
      // Check items by business_id
      const businessItems = await pool.query('SELECT business_id, COUNT(*) as count FROM items GROUP BY business_id');
      console.log('📊 Items per business:');
      businessItems.rows.forEach(row => {
        console.log(`  Business ID ${row.business_id}: ${row.count} items`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkItems();