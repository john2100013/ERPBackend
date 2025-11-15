import fs from 'fs';
import path from 'path';
import pool from './connection';

export const runMigrations = async (): Promise<void> => {
  const client = await pool.connect();

  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of migration files
    const migrationsPath = path.join(__dirname, '../../migrations');
    const migrationFiles = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const version = file.replace('.sql', '');
      
      // Check if migration has been executed
      const result = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      );

      if (result.rows.length === 0) {
        console.log(`Running migration: ${file}`);
        
        // Read and execute migration file
        const migrationPath = path.join(migrationsPath, file);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        await client.query('BEGIN');
        
        try {
          await client.query(migrationSQL);
          await client.query(
            'INSERT INTO schema_migrations (version) VALUES ($1)',
            [version]
          );
          await client.query('COMMIT');
          
          console.log(`Migration ${file} completed successfully`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      } else {
        console.log(`Migration ${file} already executed, skipping`);
      }
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  } finally {
    client.release();
  }
};

export const createTables = async (): Promise<void> => {
  console.log('Using new migration system instead of createTables');
  await runMigrations();
};

export const seedDatabase = async (): Promise<void> => {
  const client = await pool.connect();

  try {
    // Check if there are any businesses already
    const businessCount = await client.query('SELECT COUNT(*) FROM businesses');
    if (parseInt(businessCount.rows[0].count) > 0) {
      console.log('Database already has data, skipping seed');
      return;
    }

    // Seed demo business and user
    const demoBusinessResult = await client.query(`
      INSERT INTO businesses (name, email, phone, address, status)
      VALUES ('Jomart Supplies Agencies', 'info@jomartsupplies.com', '+254123456789', 'Nairobi, Kenya', 'active')
      RETURNING id
    `);

    const businessId = demoBusinessResult.rows[0].id;

    // Seed demo user (password: admin123)
    const hashedPassword = '$2b$10$rXX.Q9Z8XhZOKV1YGq1oW.rZ8QwY4uOZBZ5UZZ7x8XhZOKV1YGq1o'; // admin123
    await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role, business_id, status)
      VALUES ('admin@jomartsupplies.com', $1, 'Admin', 'User', 'owner', $2, 'active')
    `, [hashedPassword, businessId]);

    // Seed some demo items
    const demoItems = [
      { code: 'ITEM001', name: 'Office Chair - Executive', description: 'Ergonomic executive office chair', rate: 15000.00, unit: 'PCS', category: 'Furniture', quantity: 25 },
      { code: 'ITEM002', name: 'Laptop - Dell Inspiron 15', description: 'Dell Inspiron 15 3000 Series', rate: 65000.00, unit: 'PCS', category: 'Electronics', quantity: 10 },
      { code: 'ITEM003', name: 'Printer Paper A4', description: 'High quality A4 printing paper', rate: 500.00, unit: 'REAM', category: 'Stationery', quantity: 100 },
      { code: 'ITEM004', name: 'Desk Lamp - LED', description: 'Adjustable LED desk lamp', rate: 2500.00, unit: 'PCS', category: 'Electronics', quantity: 15 },
      { code: 'ITEM005', name: 'Filing Cabinet - 4 Drawer', description: 'Metal filing cabinet with 4 drawers', rate: 12000.00, unit: 'PCS', category: 'Furniture', quantity: 8 }
    ];

    for (const item of demoItems) {
      await client.query(`
        INSERT INTO items (business_id, code, item_name, description, rate, unit, category, quantity)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [businessId, item.code, item.name, item.description, item.rate, item.unit, item.category, item.quantity]);
    }

    // Seed demo order signature
    await client.query(`
      INSERT INTO order_signatures (business_id, order_created_by, order_approved_by)
      VALUES ($1, 'John Manager', 'Jane Director')
    `, [businessId]);

    console.log('Database seeded successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    client.release();
  }
};