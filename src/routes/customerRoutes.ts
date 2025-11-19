import express from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import pool from '../database/connection';

const router = express.Router();

// Get all customers for a business
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    const { search } = req.query;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    let query = `
      SELECT id, name, email, phone, address, pin, location, created_at
      FROM customers
      WHERE business_id = $1
    `;
    const params: any[] = [businessId];

    if (search) {
      query += ` AND (name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2 OR pin ILIKE $2)`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY name ASC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: {
        customers: result.rows
      }
    });
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
      error: error.message
    });
  }
});

// Get customer by ID with invoice history
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    const customerId = parseInt(req.params.id);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    // Get customer details
    const customerResult = await pool.query(
      `SELECT id, name, email, phone, address, pin, location, created_at
       FROM customers
       WHERE id = $1 AND business_id = $2`,
      [customerId, businessId]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Get customer's invoices
    const invoicesResult = await pool.query(
      `SELECT id, invoice_number, issue_date, due_date, total_amount, amount_paid, 
              payment_method, status, created_at
       FROM invoices
       WHERE customer_id = $1 AND business_id = $2
       ORDER BY created_at DESC`,
      [customerId, businessId]
    );

    res.json({
      success: true,
      data: {
        customer: customerResult.rows[0],
        invoices: invoicesResult.rows
      }
    });
  } catch (error: any) {
    console.error('Error fetching customer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer',
      error: error.message
    });
  }
});

// Create a new customer
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    const { name, email, phone, address, pin, location } = req.body;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Customer name is required'
      });
    }

    const result = await pool.query(
      `INSERT INTO customers (business_id, name, email, phone, address, pin, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [businessId, name, email, phone, address, pin, location]
    );

    res.status(201).json({
      success: true,
      data: {
        customer: result.rows[0]
      },
      message: 'Customer created successfully'
    });
  } catch (error: any) {
    console.error('Error creating customer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create customer',
      error: error.message
    });
  }
});

// Update customer
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    const customerId = parseInt(req.params.id);
    const { name, email, phone, address, pin, location } = req.body;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    const result = await pool.query(
      `UPDATE customers 
       SET name = $1, email = $2, phone = $3, address = $4, pin = $5, location = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND business_id = $8
       RETURNING *`,
      [name, email, phone, address, pin, location, customerId, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    res.json({
      success: true,
      data: {
        customer: result.rows[0]
      },
      message: 'Customer updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating customer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update customer',
      error: error.message
    });
  }
});

// Delete customer
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    const customerId = parseInt(req.params.id);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    const result = await pool.query(
      `DELETE FROM customers 
       WHERE id = $1 AND business_id = $2
       RETURNING *`,
      [customerId, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting customer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete customer',
      error: error.message
    });
  }
});

// Get customer invoice history with totals
router.get('/:id/invoices', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    const customerId = parseInt(req.params.id);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    // Get customer details
    const customerResult = await pool.query(
      `SELECT id, name, email, phone, address, pin, location
       FROM customers
       WHERE id = $1 AND business_id = $2`,
      [customerId, businessId]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Get invoices with detailed information
    const invoicesResult = await pool.query(
      `SELECT id, invoice_number, issue_date, due_date, 
              subtotal, tax_amount, total_amount, amount_paid,
              payment_method, mpesa_code, status, notes, created_at
       FROM invoices
       WHERE customer_id = $1 AND business_id = $2
       ORDER BY created_at DESC`,
      [customerId, businessId]
    );

    // Calculate totals
    const totalInvoiced = invoicesResult.rows.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
    const totalPaid = invoicesResult.rows.reduce((sum, inv) => sum + parseFloat(inv.amount_paid || 0), 0);
    const totalOutstanding = totalInvoiced - totalPaid;

    res.json({
      success: true,
      data: {
        customer: customerResult.rows[0],
        invoices: invoicesResult.rows,
        summary: {
          totalInvoices: invoicesResult.rows.length,
          totalInvoiced: totalInvoiced.toFixed(2),
          totalPaid: totalPaid.toFixed(2),
          totalOutstanding: totalOutstanding.toFixed(2)
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching customer invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer invoices',
      error: error.message
    });
  }
});

export default router;
