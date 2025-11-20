const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

(async () => {
  try {
    await client.connect();
    console.log('Running migration 015...');
    
    const sql = fs.readFileSync(
      path.join(__dirname, 'migrations', '015_add_categories_and_item_dates.sql'),
      'utf8'
    );
    
    await client.query(sql);
    console.log('Migration 015 completed successfully!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
})();
