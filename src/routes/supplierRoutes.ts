import express from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import pool from '../database/connection';

const router = express.Router();

// Get all suppliers for a business
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
      FROM suppliers
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
        suppliers: result.rows
      }
    });
  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch suppliers',
      error: error.message
    });
  }
});

// Get supplier by ID with purchase invoice history
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    const supplierId = parseInt(req.params.id);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    // Get supplier details
    const supplierResult = await pool.query(
      `SELECT id, name, email, phone, address, pin, location, created_at
       FROM suppliers
       WHERE id = $1 AND business_id = $2`,
      [supplierId, businessId]
    );

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    // Get supplier's purchase invoices
    const purchaseInvoicesResult = await pool.query(
      `SELECT id, purchase_invoice_number, issue_date, due_date, total_amount, amount_paid, 
              payment_method, status, created_at
       FROM purchase_invoices
       WHERE supplier_id = $1 AND business_id = $2
       ORDER BY created_at DESC`,
      [supplierId, businessId]
    );

    res.json({
      success: true,
      data: {
        supplier: supplierResult.rows[0],
        purchase_invoices: purchaseInvoicesResult.rows
      }
    });
  } catch (error: any) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch supplier',
      error: error.message
    });
  }
});

// Create a new supplier
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
        message: 'Supplier name is required'
      });
    }

    const result = await pool.query(
      `INSERT INTO suppliers (business_id, name, email, phone, address, pin, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [businessId, name, email, phone, address, pin, location]
    );

    res.status(201).json({
      success: true,
      data: {
        supplier: result.rows[0]
      },
      message: 'Supplier created successfully'
    });
  } catch (error: any) {
    console.error('Error creating supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create supplier',
      error: error.message
    });
  }
});

// Update supplier
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    const supplierId = parseInt(req.params.id);
    const { name, email, phone, address, pin, location } = req.body;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    const result = await pool.query(
      `UPDATE suppliers 
       SET name = $1, email = $2, phone = $3, address = $4, pin = $5, location = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND business_id = $8
       RETURNING *`,
      [name, email, phone, address, pin, location, supplierId, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.json({
      success: true,
      data: {
        supplier: result.rows[0]
      },
      message: 'Supplier updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update supplier',
      error: error.message
    });
  }
});

// Delete supplier
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    const supplierId = parseInt(req.params.id);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    const result = await pool.query(
      `DELETE FROM suppliers 
       WHERE id = $1 AND business_id = $2
       RETURNING *`,
      [supplierId, businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete supplier',
      error: error.message
    });
  }
});

// Get supplier purchase invoice history with totals
router.get('/:id/purchase-invoices', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    const supplierId = parseInt(req.params.id);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    // Get supplier details
    const supplierResult = await pool.query(
      `SELECT id, name, email, phone, address, pin, location
       FROM suppliers
       WHERE id = $1 AND business_id = $2`,
      [supplierId, businessId]
    );

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    // Get purchase invoices with detailed information
    const purchaseInvoicesResult = await pool.query(
      `SELECT id, purchase_invoice_number, issue_date, due_date, 
              subtotal, vat_amount, total_amount, amount_paid,
              payment_method, mpesa_code, status, notes, created_at
       FROM purchase_invoices
       WHERE supplier_id = $1 AND business_id = $2
       ORDER BY created_at DESC`,
      [supplierId, businessId]
    );

    // Calculate totals
    const totalPurchased = purchaseInvoicesResult.rows.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
    const totalPaid = purchaseInvoicesResult.rows.reduce((sum, inv) => sum + parseFloat(inv.amount_paid || 0), 0);
    const totalOutstanding = totalPurchased - totalPaid;

    res.json({
      success: true,
      data: {
        supplier: supplierResult.rows[0],
        purchase_invoices: purchaseInvoicesResult.rows,
        summary: {
          totalPurchaseInvoices: purchaseInvoicesResult.rows.length,
          totalPurchased: totalPurchased.toFixed(2),
          totalPaid: totalPaid.toFixed(2),
          totalOutstanding: totalOutstanding.toFixed(2)
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching supplier purchase invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch supplier purchase invoices',
      error: error.message
    });
  }
});

export default router;

