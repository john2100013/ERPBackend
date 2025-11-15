import express from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import pool from '../database/connection';
import { Invoice, InvoiceLine } from '../types';

const router = express.Router();

// Get all invoices for authenticated user's business
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    const { page = 1, limit = 10, search = '', status = '' } = req.query;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    let query = `
      SELECT i.*, u.first_name, u.last_name,
             COUNT(il.id) as line_count
      FROM invoices i
      LEFT JOIN users u ON i.created_by = u.id
      LEFT JOIN invoice_lines il ON i.id = il.invoice_id
      WHERE i.business_id = $1
    `;
    const queryParams: any[] = [businessId];
    let paramIndex = 2;

    // Add search filter
    if (search) {
      query += ` AND (i.invoice_number ILIKE $${paramIndex} OR i.customer_name ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Add status filter
    if (status) {
      query += ` AND i.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    query += ` GROUP BY i.id, u.first_name, u.last_name ORDER BY i.created_at DESC`;

    // Add pagination
    const offset = (Number(page) - 1) * Number(limit);
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(Number(limit), offset);

    const result = await pool.query(query, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT i.id) as total
      FROM invoices i
      WHERE i.business_id = $1
    `;
    const countParams: any[] = [businessId];
    let countParamIndex = 2;

    if (search) {
      countQuery += ` AND (i.invoice_number ILIKE $${countParamIndex} OR i.customer_name ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    if (status) {
      countQuery += ` AND i.status = $${countParamIndex}`;
      countParams.push(status);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: {
        invoices: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices'
    });
  }
});

// Get single invoice by ID
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    const invoiceId = req.params.id;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    // Get invoice with lines
    const invoiceResult = await pool.query(`
      SELECT i.*, u.first_name, u.last_name
      FROM invoices i
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.id = $1 AND i.business_id = $2
    `, [invoiceId, businessId]);

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const invoice = invoiceResult.rows[0];

    // Get invoice lines
    const linesResult = await pool.query(`
      SELECT il.*, i.item_name
      FROM invoice_lines il
      LEFT JOIN items i ON il.item_id = i.id
      WHERE il.invoice_id = $1
      ORDER BY il.id
    `, [invoiceId]);

    invoice.lines = linesResult.rows;

    res.json({
      success: true,
      data: invoice
    });

  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice'
    });
  }
});

// Create new invoice
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const client = await pool.connect();
  
  try {
    const businessId = req.user?.business_id;
    const userId = req.user?.id;

    if (!businessId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    const {
      customer_name,
      customer_address,
      customer_pin,
      lines,
      notes,
      due_date,
      payment_terms = 'Net 30 Days',
      quotation_id
    } = req.body;

    // Validate required fields
    if (!customer_name || !lines || lines.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer name and invoice lines are required'
      });
    }

    await client.query('BEGIN');

    // Generate invoice number
    const businessResult = await client.query('SELECT name FROM businesses WHERE id = $1', [businessId]);
    const businessName = businessResult.rows[0]?.name || 'BUS';
    const businessPrefix = businessName.substring(0, 3).toUpperCase();
    
    const invoiceNumberResult = await client.query(
      'SELECT generate_invoice_number($1) as invoice_number',
      [businessPrefix]
    );
    const invoiceNumber = invoiceNumberResult.rows[0].invoice_number;

    // Calculate totals
    let subtotal = 0;
    for (const line of lines) {
      subtotal += line.quantity * line.unit_price;
    }
    const vat_amount = subtotal * 0.16;
    const total_amount = subtotal + vat_amount;

    // Create invoice
    const invoiceResult = await client.query(`
      INSERT INTO invoices (
        business_id, invoice_number, customer_name, customer_address, customer_pin,
        subtotal, vat_amount, total_amount, quotation_id, notes, due_date, 
        payment_terms, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      businessId, invoiceNumber, customer_name, customer_address, customer_pin,
      subtotal, vat_amount, total_amount, quotation_id, notes, due_date,
      payment_terms, userId
    ]);

    const invoice = invoiceResult.rows[0];

    // Create invoice lines and update stock
    for (const line of lines) {
      // Create invoice line - ensure proper type conversion
      const itemId = parseInt(String(line.item_id));
      const quantity = parseFloat(String(line.quantity));
      const unitPrice = parseFloat(String(line.unit_price));
      
      await client.query(`
        INSERT INTO invoice_lines (
          invoice_id, item_id, quantity, unit_price, total, description, code, uom
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        invoice.id, itemId, quantity, unitPrice,
        quantity * unitPrice, line.description, line.code, line.uom
      ]);

      // Update stock quantity (reduce stock for invoice)
      await client.query(`
        UPDATE items 
        SET quantity = quantity - $1 
        WHERE id = $2 AND business_id = $3
      `, [quantity, itemId, businessId]);
    }

    // If this was converted from a quotation, update quotation status
    if (quotation_id) {
      await client.query(`
        UPDATE quotations 
        SET status = 'converted', converted_to_invoice_id = $1 
        WHERE id = $2 AND business_id = $3
      `, [invoice.id, quotation_id, businessId]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: {
        ...invoice,
        lines
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create invoice'
    });
  } finally {
    client.release();
  }
});

// Update invoice status
router.patch('/:id/status', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    const invoiceId = req.params.id;
    const { status } = req.body;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    const validStatuses = ['draft', 'sent', 'paid', 'cancelled', 'overdue'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const result = await pool.query(`
      UPDATE invoices 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND business_id = $3
      RETURNING *
    `, [status, invoiceId, businessId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      message: 'Invoice status updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating invoice status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update invoice status'
    });
  }
});

// Delete invoice
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const client = await pool.connect();
  
  try {
    const businessId = req.user?.business_id;
    const invoiceId = req.params.id;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    await client.query('BEGIN');

    // Get invoice lines to restore stock
    const linesResult = await client.query(`
      SELECT * FROM invoice_lines WHERE invoice_id = $1
    `, [invoiceId]);

    // Restore stock quantities
    for (const line of linesResult.rows) {
      await client.query(`
        UPDATE items 
        SET quantity = quantity + $1 
        WHERE id = $2 AND business_id = $3
      `, [line.quantity, line.item_id, businessId]);
    }

    // Delete invoice (lines will be deleted by CASCADE)
    const result = await client.query(`
      DELETE FROM invoices 
      WHERE id = $1 AND business_id = $2
      RETURNING *
    `, [invoiceId, businessId]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete invoice'
    });
  } finally {
    client.release();
  }
});

// Update invoice
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const client = await pool.connect();
  
  try {
    const invoiceId = parseInt(req.params.id);
    const businessId = req.user?.business_id;
    const userId = req.user?.id;

    if (!businessId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { 
      customer_name, 
      customer_address, 
      customer_pin, 
      due_date, 
      payment_terms, 
      notes, 
      lines 
    } = req.body;

    // Validate required fields
    if (!customer_name || !due_date || !lines || lines.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: customer_name, due_date, and lines are required'
      });
    }

    await client.query('BEGIN');

    // Check if invoice exists and belongs to user's business
    const existingInvoice = await client.query(`
      SELECT * FROM invoices 
      WHERE id = $1 AND business_id = $2
    `, [invoiceId, businessId]);

    if (existingInvoice.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Calculate totals
    let subtotal = 0;
    for (const line of lines) {
      subtotal += parseFloat(line.quantity) * parseFloat(line.unit_price);
    }
    const vat_amount = subtotal * 0.16;
    const total_amount = subtotal + vat_amount;

    // Update invoice
    const invoiceResult = await client.query(`
      UPDATE invoices SET 
        customer_name = $1, 
        customer_address = $2, 
        customer_pin = $3,
        subtotal = $4, 
        vat_amount = $5, 
        total_amount = $6, 
        notes = $7, 
        due_date = $8, 
        payment_terms = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10 AND business_id = $11
      RETURNING *
    `, [
      customer_name, customer_address, customer_pin,
      subtotal, vat_amount, total_amount, notes, due_date,
      payment_terms, invoiceId, businessId
    ]);

    const updatedInvoice = invoiceResult.rows[0];

    // First, restore stock quantities for old lines
    const oldLines = await client.query(`
      SELECT item_id, quantity FROM invoice_lines WHERE invoice_id = $1
    `, [invoiceId]);

    for (const oldLine of oldLines.rows) {
      await client.query(`
        UPDATE items 
        SET quantity = quantity + $1 
        WHERE id = $2 AND business_id = $3
      `, [parseFloat(oldLine.quantity), parseInt(oldLine.item_id), businessId]);
    }

    // Delete old invoice lines
    await client.query(`DELETE FROM invoice_lines WHERE invoice_id = $1`, [invoiceId]);

    // Create new invoice lines and update stock
    for (const line of lines) {
      const itemId = parseInt(String(line.item_id));
      const quantity = parseFloat(String(line.quantity));
      const unitPrice = parseFloat(String(line.unit_price));
      
      // Create new invoice line
      await client.query(`
        INSERT INTO invoice_lines (
          invoice_id, item_id, quantity, unit_price, total, description, code, uom
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        invoiceId, itemId, quantity, unitPrice,
        quantity * unitPrice, line.description, line.code, line.uom
      ]);

      // Update stock quantity (reduce stock for updated invoice)
      await client.query(`
        UPDATE items 
        SET quantity = quantity - $1 
        WHERE id = $2 AND business_id = $3
      `, [quantity, itemId, businessId]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      data: updatedInvoice,
      message: 'Invoice updated successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update invoice'
    });
  } finally {
    client.release();
  }
});

export default router;