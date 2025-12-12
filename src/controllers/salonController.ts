import { Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../database/connection';
import { AuthenticatedRequest } from '../middleware/auth';

// Get all salon users for a business
export const getSalonUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessId;
    
    console.log('🔍 Fetching salon users for business_id:', businessId);
    
    const result = await pool.query(
      `SELECT su.*, CONCAT(u.first_name, ' ', u.last_name) as name, u.email
       FROM salon_users su
       JOIN users u ON su.user_id = u.id
       WHERE su.business_id = $1
       ORDER BY su.created_at DESC`,
      [businessId]
    );

    console.log('✅ Found salon users:', result.rows.length);
    console.log('📋 Salon users data:', JSON.stringify(result.rows, null, 2));

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error: any) {
    console.error('❌ Error fetching salon users:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch salon users',
      error: error.message 
    });
  }
};

// Get available users (users not already salon users for this business)
export const getAvailableUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessId;
    
    const result = await pool.query(
      `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) as name, u.email
       FROM users u
       WHERE u.business_id = $1
         AND u.id NOT IN (
           SELECT su.user_id 
           FROM salon_users su 
           WHERE su.business_id = $1
         )
       ORDER BY u.first_name, u.last_name`,
      [businessId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching available users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch available users' });
  }
};

// Create salon user
export const createSalonUser = async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  
  try {
    const businessId = req.businessId;
    const { user_id, first_name, last_name, email, role, commission_rate } = req.body;

    await client.query('BEGIN');

    let finalUserId = user_id;

    // If user_id is not provided, create a new user
    if (!user_id && first_name && last_name) {
      // Check if email is provided and if it already exists
      if (email) {
        const existingUser = await client.query(
          'SELECT id FROM users WHERE email = $1',
          [email.toLowerCase().trim()]
        );

        if (existingUser.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            success: false, 
            message: 'Email already exists. Please select this user from the list instead.' 
          });
        }
      }

      // Generate a random password for salon employees (they can reset it later if needed)
      const randomPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
      const passwordHash = await bcrypt.hash(randomPassword, 12);

      // Generate email if not provided
      const userEmail = email || `${first_name.toLowerCase()}.${last_name.toLowerCase()}@salon.local`;

      // Create new user
      const userResult = await client.query(
        `INSERT INTO users (business_id, email, first_name, last_name, password_hash, role, status)
         VALUES ($1, $2, $3, $4, $5, 'employee', 'active')
         RETURNING id`,
        [businessId, userEmail.toLowerCase().trim(), first_name.trim(), last_name.trim(), passwordHash]
      );

      finalUserId = userResult.rows[0].id;
    }

    if (!finalUserId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: 'Either user_id or first_name and last_name must be provided' 
      });
    }

    // Check if user already exists as salon user
    const existingSalonUser = await client.query(
      'SELECT id FROM salon_users WHERE user_id = $1 AND business_id = $2',
      [finalUserId, businessId]
    );

    if (existingSalonUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: 'User is already a salon user' 
      });
    }

    // Create salon user
    const result = await client.query(
      `INSERT INTO salon_users (user_id, business_id, role, commission_rate)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [finalUserId, businessId, role || 'employee', commission_rate || 0]
    );

    await client.query('COMMIT');

    console.log('✅ Salon user created:', result.rows[0]);

    // Return the created salon user with user details
    const salonUserWithDetails = await pool.query(
      `SELECT su.*, CONCAT(u.first_name, ' ', u.last_name) as name, u.email
       FROM salon_users su
       JOIN users u ON su.user_id = u.id
       WHERE su.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json({
      success: true,
      data: salonUserWithDetails.rows[0] || result.rows[0]
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating salon user:', error);
    
    if (error.code === '23503') {
      return res.status(400).json({ 
        success: false, 
        message: 'User not found. Please create the user first or select an existing user.' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to create salon user' 
    });
  } finally {
    client.release();
  }
};

// Update salon user
export const updateSalonUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.businessId;
    const { role, commission_rate, is_active } = req.body;

    const result = await pool.query(
      `UPDATE salon_users 
       SET role = $1, commission_rate = $2, is_active = $3
       WHERE id = $4 AND business_id = $5
       RETURNING *`,
      [role, commission_rate, is_active, id, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Salon user not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating salon user:', error);
    res.status(500).json({ success: false, message: 'Failed to update salon user' });
  }
};

// Get all services
export const getServices = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessId;
    
    console.log('🔍 Fetching salon services for business_id:', businessId);

    const result = await pool.query(
      `SELECT * FROM salon_services 
       WHERE business_id = $1 AND is_active = TRUE
       ORDER BY name ASC`,
      [businessId]
    );

    // If no active services found, check all services (for debugging)
    if (result.rows.length === 0) {
      console.log('⚠️ No active services found, checking all services...');
      const allResult = await pool.query(
        `SELECT * FROM salon_services 
         WHERE business_id = $1
         ORDER BY name ASC`,
        [businessId]
      );
      console.log('📋 All services (including inactive):', allResult.rows.length);
      if (allResult.rows.length > 0) {
        console.log('⚠️ Found inactive services:', allResult.rows.map((s: any) => ({ id: s.id, name: s.name, is_active: s.is_active })));
      }
    }

    console.log('✅ Found salon services:', result.rows.length);
    console.log('📋 Salon services data:', JSON.stringify(result.rows, null, 2));

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error: any) {
    console.error('❌ Error fetching services:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch services',
      error: error.message 
    });
  }
};

// Create service
export const createService = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessId;
    const { name, description, base_price, duration_minutes } = req.body;

    console.log('🔍 Creating salon service:', { businessId, name, base_price, duration_minutes });

    const result = await pool.query(
      `INSERT INTO salon_services (business_id, name, description, base_price, duration_minutes, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING *`,
      [businessId, name, description, base_price, duration_minutes]
    );

    console.log('✅ Salon service created:', result.rows[0]);

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('❌ Error creating service:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to create service' 
    });
  }
};

// Update service
export const updateService = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.businessId;
    const { name, description, base_price, duration_minutes, is_active } = req.body;

    const result = await pool.query(
      `UPDATE salon_services 
       SET name = $1, description = $2, base_price = $3, duration_minutes = $4, is_active = $5
       WHERE id = $6 AND business_id = $7
       RETURNING *`,
      [name, description, base_price, duration_minutes, is_active, id, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({ success: false, message: 'Failed to update service' });
  }
};

// Get all products
export const getProducts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessId;

    const result = await pool.query(
      `SELECT * FROM salon_products 
       WHERE business_id = $1 AND is_active = TRUE
       ORDER BY name ASC`,
      [businessId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
};

// Create product
export const createProduct = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessId;
    const { name, description, unit, current_stock, min_stock_level, unit_cost } = req.body;

    const result = await pool.query(
      `INSERT INTO salon_products (business_id, name, description, unit, current_stock, min_stock_level, unit_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [businessId, name, description, unit, current_stock || 0, min_stock_level || 0, unit_cost || 0]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, message: 'Failed to create product' });
  }
};

// Update product
export const updateProduct = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.businessId;
    const { name, description, unit, current_stock, min_stock_level, unit_cost, is_active } = req.body;

    const result = await pool.query(
      `UPDATE salon_products 
       SET name = $1, description = $2, unit = $3, current_stock = $4, min_stock_level = $5, unit_cost = $6, is_active = $7
       WHERE id = $8 AND business_id = $9
       RETURNING *`,
      [name, description, unit, current_stock, min_stock_level, unit_cost, is_active, id, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, message: 'Failed to update product' });
  }
};

// Get low stock products
export const getLowStockProducts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessId;

    const result = await pool.query(
      `SELECT * FROM salon_products 
       WHERE business_id = $1 AND is_active = TRUE AND current_stock <= min_stock_level
       ORDER BY current_stock ASC`,
      [businessId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch low stock products' });
  }
};
