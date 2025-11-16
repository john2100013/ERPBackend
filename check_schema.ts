import { pool } from './src/database/connection';

async function checkTableStructure() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'items' 
      ORDER BY ordinal_position;
    `);
    
    console.log('Items table structure:');
    console.table(result.rows);
    
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('\nAll tables in database:');
    tables.rows.forEach((row: any) => console.log('- ' + row.table_name));
    
    await pool.end();
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkTableStructure();