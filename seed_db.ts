import { execSync } from 'child_process';
import fs from 'fs';
import pool from './src/database/connection';

async function seedDatabase() {
  try {
    console.log('🗄️  Seeding database...');
    
    // Read the SQL file
    const sql = fs.readFileSync('./seed_database.sql', 'utf8');
    
    // Execute the SQL
    await pool.query(sql);
    
    console.log('✅ Database seeded successfully!');
    console.log('📋 Tables created:');
    console.log('   - businesses (id, name, email, status, created_at, updated_at)');
    console.log('   - users (id, business_id, email, username, first_name, last_name, password_hash, role, status, is_active, created_at, updated_at)');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await pool.end();
  }
}

seedDatabase();