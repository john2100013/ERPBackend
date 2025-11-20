import { Response } from 'express';
import pool from '../database/connection';
import { AuthenticatedRequest } from '../middleware/auth';

// Get all salon users for a business
export const getSalonUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.user?.id;
    
    const result = await pool.query(
      `SELECT su.*, u.name, u.email, u.phone_number
       FROM salon_users su
       JOIN users u ON su.user_id = u.id
       WHERE su.business_id = $1
       ORDER BY su.created_at DESC`,
      [businessId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching salon users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch salon users' });
  }
};

// Create salon user
export const createSalonUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.user?.id;
    const { user_id, role, commission_rate } = req.body;

    const result = await pool.query(
      `INSERT INTO salon_users (user_id, business_id, role, commission_rate)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user_id, businessId, role, commission_rate || 0]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating salon user:', error);
    res.status(500).json({ success: false, message: 'Failed to create salon user' });
  }
};

// Update salon user
export const updateSalonUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user?.id;
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
    const businessId = req.user?.id;

    const result = await pool.query(
      `SELECT * FROM salon_services 
       WHERE business_id = $1 AND is_active = TRUE
       ORDER BY name ASC`,
      [businessId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch services' });
  }
};

// Create service
export const createService = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.user?.id;
    const { name, description, base_price, duration_minutes } = req.body;

    const result = await pool.query(
      `INSERT INTO salon_services (business_id, name, description, base_price, duration_minutes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [businessId, name, description, base_price, duration_minutes]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ success: false, message: 'Failed to create service' });
  }
};

// Update service
export const updateService = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user?.id;
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
    const businessId = req.user?.id;

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
    const businessId = req.user?.id;
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
    const businessId = req.user?.id;
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
    const businessId = req.user?.id;

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
