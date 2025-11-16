import pool from './src/database/connection.ts';

async function checkTables() {
  try {
    const result = await pool.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'businesses')
      ORDER BY table_name, ordinal_position
    `);
    
    console.log('Database Schema:');
    result.rows.forEach(row => {
      console.log(`${row.table_name}.${row.column_name} - ${row.data_type}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkTables();