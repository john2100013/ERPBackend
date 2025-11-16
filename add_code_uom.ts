import { pool } from './src/database/connection';

async function addCodeAndUomColumns() {
  try {
    console.log('🔄 Adding code and uom columns to quotation_lines and invoice_lines tables...');
    
    // Add columns to quotation_lines
    await pool.query(`
      ALTER TABLE quotation_lines
      ADD COLUMN IF NOT EXISTS code VARCHAR(100),
      ADD COLUMN IF NOT EXISTS uom VARCHAR(50);
    `);
    console.log('✅ Successfully added code and uom columns to quotation_lines');
    
    // Add columns to invoice_lines
    await pool.query(`
      ALTER TABLE invoice_lines
      ADD COLUMN IF NOT EXISTS code VARCHAR(100),
      ADD COLUMN IF NOT EXISTS uom VARCHAR(50);
    `);
    console.log('✅ Successfully added code and uom columns to invoice_lines');
    
    // Verify the changes
    const quotationStructure = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'quotation_lines' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 Updated quotation_lines columns:');
    quotationStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    const invoiceStructure = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'invoice_lines' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 Updated invoice_lines columns:');
    invoiceStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

addCodeAndUomColumns();