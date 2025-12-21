import express from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import pool from '../database/connection';

const router = express.Router();

// Get all product modifications for a business
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    const { page = 1, limit = 20, item_id } = req.query;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    let query = `
      SELECT 
        pm.*,
        i.name as item_name,
        ('ITEM' || LPAD(CAST(i.id AS TEXT), 3, '0')) as item_code,
        u.first_name,
        u.last_name
      FROM product_modifications pm
      LEFT JOIN items i ON pm.item_id = i.id
      LEFT JOIN users u ON pm.modified_by = u.id
      WHERE pm.business_id = $1
    `;
    const queryParams: any[] = [businessId];
    let paramIndex = 2;

    if (item_id) {
      query += ` AND pm.item_id = $${paramIndex}`;
      queryParams.push(parseInt(item_id as string));
      paramIndex++;
    }

    query += ` ORDER BY pm.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(Number(limit), (Number(page) - 1) * Number(limit));

    const result = await pool.query(query, queryParams);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM product_modifications WHERE business_id = $1`;
    const countParams: any[] = [businessId];
    if (item_id) {
      countQuery += ` AND item_id = $2`;
      countParams.push(parseInt(item_id as string));
    }
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        modifications: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching product modifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product modifications',
      error: error.message
    });
  }
});

// Get product modification by ID
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    const modificationId = parseInt(req.params.id);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    const result = await pool.query(`
      SELECT 
        pm.*,
        i.name as item_name,
        ('ITEM' || LPAD(CAST(i.id AS TEXT), 3, '0')) as item_code,
        u.first_name,
        u.last_name
      FROM product_modifications pm
      LEFT JOIN items i ON pm.item_id = i.id
      LEFT JOIN users u ON pm.modified_by = u.id
      WHERE pm.id = $1 AND pm.business_id = $2
    `, [modificationId, businessId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product modification not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error fetching product modification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product modification',
      error: error.message
    });
  }
});

// Delete product modification
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    const modificationId = parseInt(req.params.id);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    // Check if modification exists and belongs to the business
    const checkResult = await pool.query(
      'SELECT id FROM product_modifications WHERE id = $1 AND business_id = $2',
      [modificationId, businessId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product modification not found'
      });
    }

    // Delete the modification
    await pool.query(
      'DELETE FROM product_modifications WHERE id = $1 AND business_id = $2',
      [modificationId, businessId]
    );

    res.json({
      success: true,
      message: 'Product modification deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting product modification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product modification',
      error: error.message
    });
  }
});

export default router;

