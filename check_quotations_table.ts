import { pool } from './src/database/connection';

async function checkQuotationsTable() {
  try {
    console.log('🔍 Checking quotations table structure...');
    
    // Get table structure
    const structure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'quotations' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Quotations table structure:');
    structure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkQuotationsTable();