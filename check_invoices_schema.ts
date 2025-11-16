import { pool } from './src/database/connection';

async function checkInvoicesSchema() {
  try {
    console.log('🔍 Checking invoices table structure...');
    
    const structure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'invoices' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Invoices table columns:');
    structure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkInvoicesSchema();