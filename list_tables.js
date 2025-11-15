const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function listTables() {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log('Tables in database:');
    result.rows.forEach(row => console.log('- ' + row.table_name));
    client.release();
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listTables();