import express from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import pool from '../database/connection';
import { Quotation, QuotationLine } from '../types';

const router = express.Router();

// Logging middleware for quotation routes
router.use((req, res, next) => {
  if (req.method === 'DELETE' || req.method === 'PATCH') {
    console.log(`📄 [QUOTATION ROUTES] ${req.method} ${req.path}`);
    console.log(`📄 [QUOTATION ROUTES] Params:`, req.params);
    console.log(`📄 [QUOTATION ROUTES] Query:`, req.query);
    console.log(`📄 [QUOTATION ROUTES] Body:`, req.body);
  }
  next();
});

// Get all quotations for authenticated user's business
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
      SELECT q.*, u.first_name, u.last_name,
             COUNT(ql.id) as line_count
      FROM quotations q
      LEFT JOIN users u ON q.created_by = u.id
      LEFT JOIN quotation_lines ql ON q.id = ql.quotation_id
      WHERE q.business_id = $1
    `;
    const queryParams: any[] = [businessId];
    let paramIndex = 2;

    // Add search filter
    if (search) {
      query += ` AND (q.quotation_number ILIKE $${paramIndex} OR q.customer_name ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Add status filter
    if (status) {
      query += ` AND q.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    query += ` GROUP BY q.id, u.first_name, u.last_name ORDER BY q.created_at DESC`;

    // Add pagination
    const offset = (Number(page) - 1) * Number(limit);
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(Number(limit), offset);

    const result = await pool.query(query, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT q.id) as total
      FROM quotations q
      WHERE q.business_id = $1
    `;
    const countParams: any[] = [businessId];
    let countParamIndex = 2;

    if (search) {
      countQuery += ` AND (q.quotation_number ILIKE $${countParamIndex} OR q.customer_name ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    if (status) {
      countQuery += ` AND q.status = $${countParamIndex}`;
      countParams.push(status);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: {
        quotations: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error fetching quotations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quotations'
    });
  }
});

// Get single quotation by ID
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;
    const quotationId = req.params.id;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    // Get quotation with lines
    const quotationResult = await pool.query(`
      SELECT q.*, u.first_name, u.last_name
      FROM quotations q
      LEFT JOIN users u ON q.created_by = u.id
      WHERE q.id = $1 AND q.business_id = $2
    `, [quotationId, businessId]);

    if (quotationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    const quotation = quotationResult.rows[0];

    // Get quotation lines
    const linesResult = await pool.query(`
      SELECT ql.*, i.name as item_name
      FROM quotation_lines ql
      LEFT JOIN items i ON ql.item_id = i.id
      WHERE ql.quotation_id = $1
      ORDER BY ql.id
    `, [quotationId]);

    quotation.lines = linesResult.rows;

    res.json({
      success: true,
      data: quotation
    });

  } catch (error) {
    console.error('Error fetching quotation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quotation'
    });
  }
});

// Create new quotation
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
      customer_id,
      customer_name,
      customer_address,
      customer_pin,
      payment_method,
      mpesa_code,
      lines,
      notes,
      valid_until
    } = req.body;

    // Validate required fields
    if (!customer_name || !lines || lines.length === 0 || !valid_until) {
      return res.status(400).json({
        success: false,
        message: 'Customer name, quotation lines, and valid until date are required'
      });
    }

    await client.query('BEGIN');

    // Generate quotation number
    const businessResult = await client.query('SELECT name FROM businesses WHERE id = $1', [businessId]);
    const businessName = businessResult.rows[0]?.name || 'BUS';
    const businessPrefix = 'MQ-JM-';
    
    const quotationNumberResult = await client.query(
      'SELECT generate_quotation_number($1) as quotation_number',
      [businessPrefix]
    );
    const quotationNumber = quotationNumberResult.rows[0].quotation_number;

    // Calculate totals
    let subtotal = 0;
    for (const line of lines) {
      subtotal += line.quantity * line.unit_price;
    }
    const vat_amount = subtotal * 0.16;
    const total_before_rounding = subtotal + vat_amount;
    const total_amount = Math.round(total_before_rounding); // Round to nearest whole number

    // Create quotation (add issue_date as today's date)
    const issueDate = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format
    
    const quotationResult = await client.query(`
      INSERT INTO quotations (
        business_id, quotation_number, customer_id, customer_name, customer_address, customer_pin,
        payment_method, mpesa_code, subtotal, vat_amount, total_amount, valid_until, notes, created_by, issue_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      businessId, quotationNumber, customer_id || null, customer_name, customer_address, customer_pin,
      payment_method, mpesa_code || null, subtotal, vat_amount, total_amount, valid_until, notes, userId, issueDate
    ]);

    const quotation = quotationResult.rows[0];

    // Create quotation lines (no stock impact for quotations)
    for (const line of lines) {
      const itemId = line.item_id ? (isNaN(Number(line.item_id)) ? null : parseInt(String(line.item_id))) : null;
      
      // Fetch item category information if item_id is provided
      let categoryData = {
        category_id: null,
        category_1_id: null,
        category_2_id: null,
        category_name: null,
        category_1_name: null,
        category_2_name: null
      };

      if (itemId && !isNaN(itemId)) {
        try {
          const itemResult = await client.query(`
            SELECT 
              i.category_id,
              i.category_1_id,
              i.category_2_id,
              ic.name as category_name,
              ic1.name as category_1_name,
              ic2.name as category_2_name
            FROM items i
            LEFT JOIN item_categories ic ON i.category_id = ic.id
            LEFT JOIN item_categories ic1 ON i.category_1_id = ic1.id
            LEFT JOIN item_categories ic2 ON i.category_2_id = ic2.id
            WHERE i.id = $1 AND i.business_id = $2
          `, [itemId, businessId]);

          if (itemResult.rows.length > 0) {
            const item = itemResult.rows[0];
            categoryData = {
              category_id: item.category_id || null,
              category_1_id: item.category_1_id || null,
              category_2_id: item.category_2_id || null,
              category_name: item.category_name || null,
              category_1_name: item.category_1_name || null,
              category_2_name: item.category_2_name || null
            };
          }
        } catch (err) {
          console.error('Error fetching item categories:', err);
        }
      }

      // Check if category columns exist
      const columnCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'quotation_lines'
          AND column_name = 'category_id'
        );
      `);
      const hasCategoryColumns = columnCheck.rows[0]?.exists || false;

      if (hasCategoryColumns) {
        await client.query(`
          INSERT INTO quotation_lines (
            quotation_id, item_id, quantity, unit_price, total, description, code, uom,
            category_id, category_1_id, category_2_id, category_name, category_1_name, category_2_name
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          quotation.id, itemId, line.quantity, line.unit_price,
          line.quantity * line.unit_price, line.description, line.code, line.uom,
          categoryData.category_id, categoryData.category_1_id, categoryData.category_2_id,
          categoryData.category_name, categoryData.category_1_name, categoryData.category_2_name
        ]);
      } else {
        await client.query(`
          INSERT INTO quotation_lines (
            quotation_id, item_id, quantity, unit_price, total, description, code, uom
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          quotation.id, itemId, line.quantity, line.unit_price,
          line.quantity * line.unit_price, line.description, line.code, line.uom
        ]);
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Quotation created successfully',
      data: {
        ...quotation,
        lines
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating quotation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create quotation'
    });
  } finally {
    client.release();
  }
});

// Convert quotation to invoice
router.post('/:id/convert-to-invoice', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const client = await pool.connect();
  
  try {
    const businessId = req.user?.business_id;
    const userId = req.user?.id;
    const quotationId = req.params.id;

    if (!businessId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    await client.query('BEGIN');

    // Get quotation details
    const quotationResult = await pool.query(`
      SELECT * FROM quotations 
      WHERE id = $1 AND business_id = $2 AND status != 'converted'
    `, [quotationId, businessId]);

    if (quotationResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Quotation not found or already converted'
      });
    }

    const quotation = quotationResult.rows[0];

    // Get quotation lines
    const linesResult = await pool.query(`
      SELECT * FROM quotation_lines WHERE quotation_id = $1
    `, [quotationId]);

    // Generate invoice number
    const businessResult = await client.query('SELECT name FROM businesses WHERE id = $1', [businessId]);
    const businessName = businessResult.rows[0]?.name || 'BUS';
    const businessPrefix = businessName.substring(0, 3).toUpperCase();
    
    const invoiceNumberResult = await client.query(
      'SELECT generate_invoice_number($1) as invoice_number',
      [businessPrefix]
    );
    const invoiceNumber = invoiceNumberResult.rows[0].invoice_number;

    // Create invoice from quotation
    const issueDate = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format
    const invoiceResult = await client.query(`
      INSERT INTO invoices (
        business_id, invoice_number, customer_name, customer_address, customer_pin,
        subtotal, vat_amount, total_amount, quotation_id, notes, 
        due_date, payment_terms, created_by, issue_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      businessId, invoiceNumber, quotation.customer_name, quotation.customer_address, 
      quotation.customer_pin, quotation.subtotal, quotation.vat_amount, quotation.total_amount,
      quotationId, quotation.notes, 
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      'Net 30 Days', userId, issueDate
    ]);

    const invoice = invoiceResult.rows[0];

    // Create invoice lines and update stock
    for (const line of linesResult.rows) {
      // Fetch category data from quotation line if available, otherwise from item
      let categoryData = {
        category_id: line.category_id || null,
        category_1_id: line.category_1_id || null,
        category_2_id: line.category_2_id || null,
        category_name: line.category_name || null,
        category_1_name: line.category_1_name || null,
        category_2_name: line.category_2_name || null
      };

      // If categories not in quotation line, fetch from item
      if (!categoryData.category_id && !categoryData.category_1_id && !categoryData.category_2_id && line.item_id) {
        try {
          const itemResult = await client.query(`
            SELECT 
              i.category_id,
              i.category_1_id,
              i.category_2_id,
              ic.name as category_name,
              ic1.name as category_1_name,
              ic2.name as category_2_name
            FROM items i
            LEFT JOIN item_categories ic ON i.category_id = ic.id
            LEFT JOIN item_categories ic1 ON i.category_1_id = ic1.id
            LEFT JOIN item_categories ic2 ON i.category_2_id = ic2.id
            WHERE i.id = $1 AND i.business_id = $2
          `, [line.item_id, businessId]);

          if (itemResult.rows.length > 0) {
            const item = itemResult.rows[0];
            categoryData = {
              category_id: item.category_id || null,
              category_1_id: item.category_1_id || null,
              category_2_id: item.category_2_id || null,
              category_name: item.category_name || null,
              category_1_name: item.category_1_name || null,
              category_2_name: item.category_2_name || null
            };
          }
        } catch (err) {
          console.error('Error fetching item categories:', err);
        }
      }

      // Check if category columns exist
      const columnCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'invoice_lines'
          AND column_name = 'category_id'
        );
      `);
      const hasCategoryColumns = columnCheck.rows[0]?.exists || false;

      if (hasCategoryColumns) {
        await client.query(`
          INSERT INTO invoice_lines (
            invoice_id, item_id, quantity, unit_price, total, description, code, uom,
            category_id, category_1_id, category_2_id, category_name, category_1_name, category_2_name
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          invoice.id, line.item_id, line.quantity, line.unit_price,
          line.total, line.description, line.code, line.uom,
          categoryData.category_id, categoryData.category_1_id, categoryData.category_2_id,
          categoryData.category_name, categoryData.category_1_name, categoryData.category_2_name
        ]);
      } else {
        await client.query(`
          INSERT INTO invoice_lines (
            invoice_id, item_id, quantity, unit_price, total, description, code, uom
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          invoice.id, line.item_id, line.quantity, line.unit_price,
          line.total, line.description, line.code, line.uom
        ]);
      }

      // Update stock quantity (reduce stock for invoice)
      await client.query(`
        UPDATE items 
        SET quantity = quantity - $1 
        WHERE id = $2 AND business_id = $3
      `, [line.quantity, line.item_id, businessId]);
    }

    // Update quotation status
    await client.query(`
      UPDATE quotations 
      SET status = 'converted', converted_to_invoice_id = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND business_id = $3
    `, [invoice.id, quotationId, businessId]);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Quotation converted to invoice successfully',
      data: {
        invoice,
        quotation_id: quotationId
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error converting quotation to invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to convert quotation to invoice'
    });
  } finally {
    client.release();
  }
});

// Update quotation status
router.patch('/:id/status', authenticateToken, async (req: AuthenticatedRequest, res) => {
  console.log('🟡 [QUOTATION STATUS UPDATE] Request received');
  console.log('🟡 [QUOTATION STATUS UPDATE] Route: PATCH /quotations/:id/status');
  console.log('🟡 [QUOTATION STATUS UPDATE] Params:', req.params);
  console.log('🟡 [QUOTATION STATUS UPDATE] Body:', req.body);
  console.log('🟡 [QUOTATION STATUS UPDATE] User:', { id: req.user?.id, business_id: req.user?.business_id });
  
  try {
    const businessId = req.user?.business_id;
    const quotationId = req.params.id;
    const { status } = req.body;

    console.log('🟡 [QUOTATION STATUS UPDATE] Processing:', { quotationId, status, businessId });

    if (!businessId) {
      console.error('❌ [QUOTATION STATUS UPDATE] No business ID found');
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    const validStatuses = ['draft', 'sent', 'accepted', 'rejected', 'expired'];
    if (!validStatuses.includes(status)) {
      console.error('❌ [QUOTATION STATUS UPDATE] Invalid status:', status);
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    console.log('🟡 [QUOTATION STATUS UPDATE] Executing database query...');
    const result = await pool.query(`
      UPDATE quotations 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND business_id = $3 AND status != 'converted'
      RETURNING *
    `, [status, quotationId, businessId]);

    console.log('🟡 [QUOTATION STATUS UPDATE] Query result:', { rowsAffected: result.rows.length });

    if (result.rows.length === 0) {
      console.error('❌ [QUOTATION STATUS UPDATE] Quotation not found or already converted:', { quotationId, businessId });
      return res.status(404).json({
        success: false,
        message: 'Quotation not found or already converted'
      });
    }

    console.log('✅ [QUOTATION STATUS UPDATE] Success:', result.rows[0]);
    res.json({
      success: true,
      message: 'Quotation status updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('❌ [QUOTATION STATUS UPDATE] Error:', error);
    console.error('❌ [QUOTATION STATUS UPDATE] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({
      success: false,
      message: 'Failed to update quotation status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update quotation
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const client = await pool.connect();
  
  try {
    const businessId = req.user?.business_id;
    const userId = req.user?.id;
    const quotationId = req.params.id;

    if (!businessId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    const {
      customer_id,
      customer_name,
      customer_address,
      customer_pin,
      payment_method,
      mpesa_code,
      lines,
      notes,
      valid_until
    } = req.body;

    // Validate required fields
    if (!customer_name || !lines || lines.length === 0 || !valid_until) {
      return res.status(400).json({
        success: false,
        message: 'Customer name, quotation lines, and valid until date are required'
      });
    }

    // Check if quotation exists and belongs to the business
    const existingQuotation = await client.query(
      'SELECT * FROM quotations WHERE id = $1 AND business_id = $2',
      [quotationId, businessId]
    );

    if (existingQuotation.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // Check if quotation is already converted
    if (existingQuotation.rows[0].status === 'converted') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update converted quotation'
      });
    }

    await client.query('BEGIN');

    // Calculate totals
    let subtotal = 0;
    for (const line of lines) {
      subtotal += line.quantity * line.unit_price;
    }
    const vat_amount = subtotal * 0.16;
    const total_before_rounding = subtotal + vat_amount;
    const total_amount = Math.round(total_before_rounding); // Round to nearest whole number

    // Update quotation
    const quotationResult = await client.query(`
      UPDATE quotations SET
        customer_id = $1,
        customer_name = $2,
        customer_address = $3,
        customer_pin = $4,
        payment_method = $5,
        mpesa_code = $6,
        subtotal = $7,
        vat_amount = $8,
        total_amount = $9,
        valid_until = $10,
        notes = $11,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12 AND business_id = $13
      RETURNING *
    `, [
      customer_id || null, customer_name, customer_address, customer_pin,
      payment_method, mpesa_code || null,
      subtotal, vat_amount, total_amount, valid_until, notes,
      quotationId, businessId
    ]);

    // Delete existing quotation lines
    await client.query('DELETE FROM quotation_lines WHERE quotation_id = $1', [quotationId]);

    // Create new quotation lines
    for (const line of lines) {
      const itemId = line.item_id ? (isNaN(Number(line.item_id)) ? null : parseInt(String(line.item_id))) : null;
      
      // Fetch item category information if item_id is provided
      let categoryData = {
        category_id: null,
        category_1_id: null,
        category_2_id: null,
        category_name: null,
        category_1_name: null,
        category_2_name: null
      };

      if (itemId && !isNaN(itemId)) {
        try {
          const itemResult = await client.query(`
            SELECT 
              i.category_id,
              i.category_1_id,
              i.category_2_id,
              ic.name as category_name,
              ic1.name as category_1_name,
              ic2.name as category_2_name
            FROM items i
            LEFT JOIN item_categories ic ON i.category_id = ic.id
            LEFT JOIN item_categories ic1 ON i.category_1_id = ic1.id
            LEFT JOIN item_categories ic2 ON i.category_2_id = ic2.id
            WHERE i.id = $1 AND i.business_id = $2
          `, [itemId, businessId]);

          if (itemResult.rows.length > 0) {
            const item = itemResult.rows[0];
            categoryData = {
              category_id: item.category_id || null,
              category_1_id: item.category_1_id || null,
              category_2_id: item.category_2_id || null,
              category_name: item.category_name || null,
              category_1_name: item.category_1_name || null,
              category_2_name: item.category_2_name || null
            };
          }
        } catch (err) {
          console.error('Error fetching item categories:', err);
        }
      }

      // Check if category columns exist
      const columnCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'quotation_lines'
          AND column_name = 'category_id'
        );
      `);
      const hasCategoryColumns = columnCheck.rows[0]?.exists || false;

      if (hasCategoryColumns) {
        await client.query(`
          INSERT INTO quotation_lines (
            quotation_id, item_id, quantity, unit_price, total, description, code, uom,
            category_id, category_1_id, category_2_id, category_name, category_1_name, category_2_name
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          quotationId, itemId, line.quantity, line.unit_price,
          line.quantity * line.unit_price, line.description, line.code, line.uom,
          categoryData.category_id, categoryData.category_1_id, categoryData.category_2_id,
          categoryData.category_name, categoryData.category_1_name, categoryData.category_2_name
        ]);
      } else {
        await client.query(`
          INSERT INTO quotation_lines (
            quotation_id, item_id, quantity, unit_price, total, description, code, uom
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          quotationId, itemId, line.quantity, line.unit_price,
          line.quantity * line.unit_price, line.description, line.code, line.uom
        ]);
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Quotation updated successfully',
      data: {
        ...quotationResult.rows[0],
        lines
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating quotation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quotation'
    });
  } finally {
    client.release();
  }
});

// Delete quotation
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  console.log('🟠 [QUOTATION DELETE] Request received');
  console.log('🟠 [QUOTATION DELETE] Route: DELETE /quotations/:id');
  console.log('🟠 [QUOTATION DELETE] Params:', req.params);
  console.log('🟠 [QUOTATION DELETE] User:', { id: req.user?.id, business_id: req.user?.business_id });
  
  try {
    const businessId = req.user?.business_id;
    const quotationId = parseInt(req.params.id);
    
    console.log('🟠 [QUOTATION DELETE] Processing:', { quotationId, businessId });
    
    if (isNaN(quotationId)) {
      console.error('❌ [QUOTATION DELETE] Invalid quotation ID:', req.params.id);
      return res.status(400).json({
        success: false,
        message: 'Invalid quotation ID'
      });
    }

    if (!businessId) {
      console.error('❌ [QUOTATION DELETE] No business ID found');
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    // Delete quotation (lines will be deleted by CASCADE)
    console.log('🟠 [QUOTATION DELETE] Executing database query...');
    const result = await pool.query(`
      DELETE FROM quotations 
      WHERE id = $1 AND business_id = $2 AND status != 'converted'
      RETURNING *
    `, [quotationId, businessId]);

    console.log('🟠 [QUOTATION DELETE] Query result:', { rowsAffected: result.rows.length });

    if (result.rows.length === 0) {
      console.error('❌ [QUOTATION DELETE] Quotation not found or already converted:', { quotationId, businessId });
      return res.status(404).json({
        success: false,
        message: 'Quotation not found or already converted'
      });
    }

    console.log('✅ [QUOTATION DELETE] Success:', result.rows[0]);
    res.json({
      success: true,
      message: 'Quotation deleted successfully'
    });

  } catch (error) {
    console.error('❌ [QUOTATION DELETE] Error:', error);
    console.error('❌ [QUOTATION DELETE] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({
      success: false,
      message: 'Failed to delete quotation',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;