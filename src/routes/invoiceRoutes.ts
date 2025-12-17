import express from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import pool from '../database/connection';
import { Invoice, InvoiceLine } from '../types';

const router = express.Router();

// Logging middleware for invoice routes
router.use((req, res, next) => {
  if (req.method === 'DELETE' || req.method === 'PATCH') {
    console.log(`📋 [INVOICE ROUTES] ${req.method} ${req.path}`);
    console.log(`📋 [INVOICE ROUTES] Params:`, req.params);
    console.log(`📋 [INVOICE ROUTES] Query:`, req.query);
    console.log(`📋 [INVOICE ROUTES] Body:`, req.body);
  }
  next();
});

// Get next invoice number
router.get('/next-invoice-number', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    // Get business details for prefix
    const businessResult = await pool.query('SELECT name FROM businesses WHERE id = $1', [businessId]);
    if (businessResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    const businessName = businessResult.rows[0].name || 'BUS';
    const businessPrefix = 'IV-JM-';
    
    console.log('Generating invoice number for business:', businessName, 'Prefix:', businessPrefix);
    
    // Generate the next invoice number using the database function
    const invoiceNumberResult = await pool.query(
      'SELECT generate_invoice_number($1) as invoice_number',
      [businessPrefix]
    );

    if (!invoiceNumberResult.rows || invoiceNumberResult.rows.length === 0) {
      throw new Error('No invoice number generated');
    }

    const invoiceNumber = invoiceNumberResult.rows[0].invoice_number;
    console.log('Generated invoice number:', invoiceNumber);

    res.json({
      success: true,
      data: {
        invoiceNumber
      }
    });
  } catch (error) {
    console.error('Error generating invoice number:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice number',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

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
      SELECT il.*, i.name as item_name
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

// Save invoice as draft (POS hold function)
router.post('/draft', authenticateToken, async (req: AuthenticatedRequest, res) => {
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

    const { items, total, account_id } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items are required'
      });
    }

    await client.query('BEGIN');

    // Calculate totals
    let subtotal = 0;
    for (const item of items) {
      subtotal += item.amount;
    }
    const vat_amount = subtotal * 0.16;
    const total_before_rounding = subtotal + vat_amount;
    const total_amount = Math.round(total_before_rounding);

    // Create draft invoice (without invoice number, status = 'draft')
    const invoiceResult = await client.query(`
      INSERT INTO invoices (
        business_id, invoice_number, customer_name, customer_address, customer_pin,
        due_date, payment_terms, subtotal, vat_amount, total_amount, amount_paid,
        payment_status, status, notes, created_by, issue_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      businessId, 
      'DRAFT', // Temporary invoice number for drafts
      'Walk-in Customer', // Default customer for POS
      '', 
      '',
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Due date 30 days from now
      'Cash',
      subtotal,
      vat_amount,
      total_amount,
      0, // amount_paid
      'unpaid',
      'draft', // status
      account_id ? `Account: ${account_id}` : '',
      userId,
      new Date() // issue_date
    ]);

    const invoice = invoiceResult.rows[0];

    // Create invoice lines
    for (const item of items) {
      const itemId = item.id ? (isNaN(Number(item.id)) ? null : parseInt(String(item.id))) : null;
      
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
            const itemRow = itemResult.rows[0];
            categoryData = {
              category_id: itemRow.category_id || null,
              category_1_id: itemRow.category_1_id || null,
              category_2_id: itemRow.category_2_id || null,
              category_name: itemRow.category_name || null,
              category_1_name: itemRow.category_1_name || null,
              category_2_name: itemRow.category_2_name || null
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
          invoice.id,
          itemId,
          item.quantity,
          item.rate,
          item.amount,
          item.name,
          item.code || '',
          item.unit || 'PCS',
          categoryData.category_id,
          categoryData.category_1_id,
          categoryData.category_2_id,
          categoryData.category_name,
          categoryData.category_1_name,
          categoryData.category_2_name
        ]);
      } else {
        await client.query(`
          INSERT INTO invoice_lines (
            invoice_id, item_id, quantity, unit_price, total, description, code, uom
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          invoice.id,
          itemId,
          item.quantity,
          item.rate,
          item.amount,
          item.name,
          item.code || '',
          item.unit || 'PCS'
        ]);
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Draft saved successfully',
      data: {
        ...invoice,
        items
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving draft:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save draft',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
  }
});

// Get all draft invoices
router.get('/drafts/list', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const businessId = req.user?.business_id;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    const result = await pool.query(`
      SELECT i.*, u.first_name, u.last_name,
             COUNT(il.id) as line_count
      FROM invoices i
      LEFT JOIN users u ON i.created_by = u.id
      LEFT JOIN invoice_lines il ON i.id = il.invoice_id
      WHERE i.business_id = $1 AND i.status = 'draft'
      GROUP BY i.id, u.first_name, u.last_name
      ORDER BY i.created_at DESC
    `, [businessId]);

    res.json({
      success: true,
      data: {
        invoices: result.rows
      }
    });

  } catch (error) {
    console.error('Error fetching drafts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch drafts'
    });
  }
});

// Convert draft to real invoice
router.post('/draft/:id/convert', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const client = await pool.connect();
  
  try {
    const businessId = req.user?.business_id;
    const draftId = req.params.id;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    // Check if draft exists
    const draftResult = await client.query(
      'SELECT * FROM invoices WHERE id = $1 AND business_id = $2 AND status = $3',
      [draftId, businessId, 'draft']
    );

    if (draftResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Draft not found'
      });
    }

    await client.query('BEGIN');

    // Generate invoice number
    const businessResult = await client.query('SELECT name FROM businesses WHERE id = $1', [businessId]);
    const businessPrefix = 'IV-JM-';
    
    const invoiceNumberResult = await client.query(
      'SELECT generate_invoice_number($1) as invoice_number',
      [businessPrefix]
    );
    const invoiceNumber = invoiceNumberResult.rows[0].invoice_number;

    // Update draft to real invoice
    const updateResult = await client.query(`
      UPDATE invoices 
      SET invoice_number = $1, 
          status = 'unpaid',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND business_id = $3
      RETURNING *
    `, [invoiceNumber, draftId, businessId]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Draft converted to invoice successfully',
      data: updateResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error converting draft:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to convert draft'
    });
  } finally {
    client.release();
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
      customer_id,
      customer_name,
      customer_address,
      customer_pin,
      lines,
      notes,
      due_date,
      payment_terms = 'Net 30 Days',
      payment_method = 'Cash',
      mpesa_code,
      quotation_id,
      amountPaid = 0,
      paymentMethod,
      discount_amount = 0
    } = req.body;

    // Validate required fields
    if (!customer_name || !lines || lines.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer name and invoice lines are required'
      });
    }

    // Validate amountPaid
    const parsedAmountPaid = parseFloat(String(amountPaid)) || 0;
    if (parsedAmountPaid < 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount paid cannot be negative'
      });
    }

    // Parse paymentMethod as financial account ID if it's a number
    // paymentMethod can be a number (financial account ID) or string (like "Cash", "M-Pesa")
    let financialAccountId: number | null = null;
    if (paymentMethod) {
      const parsedPaymentMethod = typeof paymentMethod === 'string' 
        ? (isNaN(Number(paymentMethod)) ? null : parseInt(String(paymentMethod)))
        : (isNaN(Number(paymentMethod)) ? null : parseInt(String(paymentMethod)));
      
      if (parsedPaymentMethod !== null && !isNaN(parsedPaymentMethod) && parsedPaymentMethod > 0) {
        financialAccountId = parsedPaymentMethod;
      }
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
    const discountAmount = parseFloat(String(discount_amount)) || 0;
    const total_before_discount = subtotal + vat_amount;
    const total_before_rounding = Math.max(0, total_before_discount - discountAmount); // Ensure total doesn't go negative
    const total_amount = Math.round(total_before_rounding); // Round to nearest whole number

    // Determine payment status and invoice status based on amount paid vs total
    // payment_status: 'unpaid', 'partial', 'paid', 'overpaid'
    // status: 'draft', 'sent', 'paid', 'partially_paid', 'cancelled', 'overdue'
    let paymentStatus = 'unpaid';
    let invoiceStatus = 'sent'; // Default to 'sent' when invoice is created (not draft)
    
    if (parsedAmountPaid >= total_amount) {
      paymentStatus = 'paid';
      invoiceStatus = 'paid'; // Fully paid
    } else if (parsedAmountPaid > 0) {
      paymentStatus = 'partial';
      invoiceStatus = 'partially_paid'; // Partially paid
    } else {
      paymentStatus = 'unpaid';
      invoiceStatus = 'sent'; // Unpaid, invoice was sent
    }

    // Create invoice with issue_date as today's date
    const issueDate = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format
    
    const invoiceResult = await client.query(`
      INSERT INTO invoices (
        business_id, invoice_number, customer_id, customer_name, customer_address, customer_pin,
        subtotal, vat_amount, discount, total_amount, amount_paid, payment_status, status, payment_method, mpesa_code,
        quotation_id, notes, due_date, payment_terms, created_by, issue_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *
    `, [
      businessId, invoiceNumber, customer_id || null, customer_name, customer_address, customer_pin,
      subtotal, vat_amount, discountAmount, total_amount, parsedAmountPaid, paymentStatus, invoiceStatus, payment_method || 'Cash', 
      mpesa_code || null, quotation_id, notes, due_date, payment_terms, userId, issueDate
    ]);

    const invoice = invoiceResult.rows[0];

    // Create invoice lines and update stock
    for (const line of lines) {
      // Create invoice line - ensure proper type conversion
      const itemId = line.item_id ? (isNaN(Number(line.item_id)) ? null : parseInt(String(line.item_id))) : null;
      const quantity = parseFloat(String(line.quantity));
      const unitPrice = parseFloat(String(line.unit_price));
      
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
          // Continue without category data if there's an error
        }
      }
      
      // Check if category columns exist in invoice_lines table
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
          invoice.id, itemId, quantity, unitPrice,
          quantity * unitPrice, line.description, line.code, line.uom,
          categoryData.category_id, categoryData.category_1_id, categoryData.category_2_id,
          categoryData.category_name, categoryData.category_1_name, categoryData.category_2_name
        ]);
      } else {
        await client.query(`
          INSERT INTO invoice_lines (
            invoice_id, item_id, quantity, unit_price, total, description, code, uom
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          invoice.id, itemId, quantity, unitPrice,
          quantity * unitPrice, line.description, line.code, line.uom
        ]);
      }

      // Update stock quantity (reduce stock for invoice) - only if item_id is provided
      if (itemId && !isNaN(itemId)) {
        await client.query(`
          UPDATE items 
          SET quantity = quantity - $1 
          WHERE id = $2 AND business_id = $3
        `, [quantity, itemId, businessId]);
      }
    }

    // If payment is made and a financial account is selected, update the account balance
    // For invoices: INCREASE balance by amount paid (money coming in)
    if (parsedAmountPaid > 0 && financialAccountId !== null && !isNaN(financialAccountId)) {
      // Update financial account balance (increase by amount paid)
      await client.query(`
        UPDATE financial_accounts 
        SET current_balance = current_balance + $1, updated_at = NOW()
        WHERE id = $2 AND business_id = $3
      `, [parsedAmountPaid, financialAccountId, businessId]);

      // Map payment_method to valid constraint values: 'cash', 'bank', 'mobile_money', 'cheque', 'card'
      let validPaymentMethod = 'cash'; // default
      const paymentMethodStr = String(payment_method || payment_terms || '').toLowerCase();
      if (paymentMethodStr.includes('mpesa') || paymentMethodStr.includes('m-pesa') || paymentMethodStr === 'mobile_money') {
        validPaymentMethod = 'mobile_money';
      } else if (paymentMethodStr.includes('bank')) {
        validPaymentMethod = 'bank';
      } else if (paymentMethodStr.includes('cheque') || paymentMethodStr.includes('check')) {
        validPaymentMethod = 'cheque';
      } else if (paymentMethodStr.includes('card')) {
        validPaymentMethod = 'card';
      } else {
        validPaymentMethod = 'cash';
      }

      // Create a payment record for audit trail
      await client.query(`
        INSERT INTO invoice_payments (
          invoice_id, financial_account_id, amount, payment_method, 
          payment_reference, payment_date, business_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
      `, [
        invoice.id, financialAccountId, parsedAmountPaid, validPaymentMethod,
        `INV-${invoiceNumber}`, businessId, userId
      ]);
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
  console.log('🔵 [INVOICE STATUS UPDATE] Request received');
  console.log('🔵 [INVOICE STATUS UPDATE] Route: PATCH /invoices/:id/status');
  console.log('🔵 [INVOICE STATUS UPDATE] Params:', req.params);
  console.log('🔵 [INVOICE STATUS UPDATE] Body:', req.body);
  console.log('🔵 [INVOICE STATUS UPDATE] User:', { id: req.user?.id, business_id: req.user?.business_id });
  
  try {
    const businessId = req.user?.business_id;
    const invoiceId = req.params.id;
    const { status } = req.body;

    console.log('🔵 [INVOICE STATUS UPDATE] Processing:', { invoiceId, status, businessId });

    if (!businessId) {
      console.error('❌ [INVOICE STATUS UPDATE] No business ID found');
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    const validStatuses = ['draft', 'sent', 'paid', 'partially_paid', 'cancelled', 'overdue'];
    if (!validStatuses.includes(status)) {
      console.error('❌ [INVOICE STATUS UPDATE] Invalid status:', status);
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    console.log('🔵 [INVOICE STATUS UPDATE] Executing database query...');
    const result = await pool.query(`
      UPDATE invoices 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND business_id = $3
      RETURNING *
    `, [status, invoiceId, businessId]);

    console.log('🔵 [INVOICE STATUS UPDATE] Query result:', { rowsAffected: result.rows.length });

    if (result.rows.length === 0) {
      console.error('❌ [INVOICE STATUS UPDATE] Invoice not found:', { invoiceId, businessId });
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    console.log('✅ [INVOICE STATUS UPDATE] Success:', result.rows[0]);
    res.json({
      success: true,
      message: 'Invoice status updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('❌ [INVOICE STATUS UPDATE] Error:', error);
    console.error('❌ [INVOICE STATUS UPDATE] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({
      success: false,
      message: 'Failed to update invoice status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete invoice
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  console.log('🔴 [INVOICE DELETE] Request received');
  console.log('🔴 [INVOICE DELETE] Route: DELETE /invoices/:id');
  console.log('🔴 [INVOICE DELETE] Params:', req.params);
  console.log('🔴 [INVOICE DELETE] User:', { id: req.user?.id, business_id: req.user?.business_id });
  
  const client = await pool.connect();
  
  try {
    const businessId = req.user?.business_id;
    const invoiceId = parseInt(req.params.id);
    
    console.log('🔴 [INVOICE DELETE] Processing:', { invoiceId, businessId });
    
    if (isNaN(invoiceId)) {
      console.error('❌ [INVOICE DELETE] Invalid invoice ID:', req.params.id);
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice ID'
      });
    }

    if (!businessId) {
      console.error('❌ [INVOICE DELETE] No business ID found');
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    console.log('🔴 [INVOICE DELETE] Starting transaction...');
    await client.query('BEGIN');

    // Get invoice lines to restore stock
    console.log('🔴 [INVOICE DELETE] Fetching invoice lines...');
    const linesResult = await client.query(`
      SELECT * FROM invoice_lines WHERE invoice_id = $1
    `, [invoiceId]);
    console.log('🔴 [INVOICE DELETE] Found lines:', linesResult.rows.length);

    // Restore stock quantities
    for (const line of linesResult.rows) {
      console.log('🔴 [INVOICE DELETE] Restoring stock for item:', line.item_id, 'quantity:', line.quantity);
      await client.query(`
        UPDATE items 
        SET quantity = quantity + $1 
        WHERE id = $2 AND business_id = $3
      `, [line.quantity, line.item_id, businessId]);
    }

    // Delete invoice (lines will be deleted by CASCADE)
    console.log('🔴 [INVOICE DELETE] Deleting invoice...');
    const result = await client.query(`
      DELETE FROM invoices 
      WHERE id = $1 AND business_id = $2
      RETURNING *
    `, [invoiceId, businessId]);

    console.log('🔴 [INVOICE DELETE] Delete result:', { rowsAffected: result.rows.length });

    if (result.rows.length === 0) {
      console.error('❌ [INVOICE DELETE] Invoice not found:', { invoiceId, businessId });
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    await client.query('COMMIT');
    console.log('✅ [INVOICE DELETE] Success:', result.rows[0]);

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [INVOICE DELETE] Error:', error);
    console.error('❌ [INVOICE DELETE] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({
      success: false,
      message: 'Failed to delete invoice',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    client.release();
    console.log('🔴 [INVOICE DELETE] Database client released');
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
      lines,
      discount_amount = 0,
      amountPaid = 0
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
    const discountAmount = parseFloat(String(discount_amount)) || 0;
    const total_before_discount = subtotal + vat_amount;
    const total_amount = Math.max(0, Math.round(total_before_discount - discountAmount)); // Ensure total doesn't go negative
    
    // Parse amount paid
    const parsedAmountPaid = parseFloat(String(amountPaid)) || 0;
    
    // Determine payment status and invoice status based on amount paid vs total
    // payment_status: 'unpaid', 'partial', 'paid', 'overpaid'
    // status: 'draft', 'sent', 'paid', 'partially_paid', 'cancelled', 'overdue'
    let paymentStatus = 'unpaid';
    let invoiceStatus = existingInvoice.rows[0].status || 'sent'; // Keep existing status if not changing
    
    if (parsedAmountPaid >= total_amount) {
      paymentStatus = 'paid';
      invoiceStatus = 'paid'; // Fully paid - amount paid is greater than or equal to total
    } else if (parsedAmountPaid > 0) {
      paymentStatus = 'partial';
      invoiceStatus = 'partially_paid'; // Partially paid
    } else {
      paymentStatus = 'unpaid';
      // Only change to 'sent' if it's not already 'draft' or 'cancelled'
      if (invoiceStatus !== 'draft' && invoiceStatus !== 'cancelled') {
        invoiceStatus = 'sent'; // Unpaid, invoice was sent
      }
    }

    // Update invoice
    const invoiceResult = await client.query(`
      UPDATE invoices SET 
        customer_name = $1, 
        customer_address = $2, 
        customer_pin = $3,
        subtotal = $4, 
        vat_amount = $5,
        discount = $6,
        total_amount = $7,
        amount_paid = $8,
        payment_status = $9,
        status = $10,
        notes = $11, 
        due_date = $12, 
        payment_terms = $13,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $14 AND business_id = $15
      RETURNING *
    `, [
      customer_name, customer_address, customer_pin,
      subtotal, vat_amount, discountAmount, total_amount, parsedAmountPaid, paymentStatus, invoiceStatus,
      notes, due_date, payment_terms, invoiceId, businessId
    ]);

    const updatedInvoice = invoiceResult.rows[0];

    // First, restore stock quantities for old lines (only for products, not services)
    const oldLines = await client.query(`
      SELECT item_id, quantity FROM invoice_lines WHERE invoice_id = $1 AND item_id IS NOT NULL
    `, [invoiceId]);

    for (const oldLine of oldLines.rows) {
      const itemId = parseInt(String(oldLine.item_id));
      if (!isNaN(itemId) && itemId > 0) {
        await client.query(`
          UPDATE items 
          SET quantity = quantity + $1 
          WHERE id = $2 AND business_id = $3
        `, [parseFloat(oldLine.quantity) || 0, itemId, businessId]);
      }
    }

    // Delete old invoice lines
    await client.query(`DELETE FROM invoice_lines WHERE invoice_id = $1`, [invoiceId]);

    // Create new invoice lines and update stock
    for (const line of lines) {
      // Handle item_id - can be null for services
      // Check if item_id exists and is a valid number
      let itemId: number | null = null;
      if (line.item_id !== null && line.item_id !== undefined && line.item_id !== 'null' && line.item_id !== '') {
        const parsed = parseInt(String(line.item_id), 10);
        if (!isNaN(parsed) && parsed > 0) {
          itemId = parsed;
        }
      }
      
      const quantity = parseFloat(String(line.quantity)) || 0;
      const unitPrice = parseFloat(String(line.unit_price)) || 0;
      
      // Create new invoice line
      await client.query(`
        INSERT INTO invoice_lines (
          invoice_id, item_id, quantity, unit_price, total, description, code, uom
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        invoiceId, itemId, quantity, unitPrice,
        quantity * unitPrice, line.description || '', line.code || '', line.uom || ''
      ]);

      // Update stock quantity (reduce stock for updated invoice) - only for products, not services
      if (itemId !== null && itemId > 0) {
        await client.query(`
          UPDATE items 
          SET quantity = quantity - $1 
          WHERE id = $2 AND business_id = $3
        `, [quantity, itemId, businessId]);
      }
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