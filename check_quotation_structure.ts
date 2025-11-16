import { pool } from './src/database/connection';

async function checkQuotationLinesTable() {
  try {
    console.log('🔍 Checking quotation_lines table structure...');
    
    // Get table structure
    const structure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'quotation_lines' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 quotation_lines table structure:');
    structure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default})`);
    });
    
    // Check quotations table structure
    const quotationsStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'quotations' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 quotations table structure:');
    quotationsStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkQuotationLinesTable();