import express from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import pool from '../database/connection';

const router = express.Router();

// Get next purchase invoice number
router.get('/next-purchase-invoice-number', authenticateToken, async (req: AuthenticatedRequest, res) => {
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
    const businessPrefix = 'PI-' + businessName.substring(0, 3).toUpperCase() + '-';
    
    console.log('Generating purchase invoice number for business:', businessName, 'Prefix:', businessPrefix);
    
    // Generate the next purchase invoice number using the database function
    const purchaseInvoiceNumberResult = await pool.query(
      'SELECT generate_purchase_invoice_number($1) as purchase_invoice_number',
      [businessPrefix]
    );

    if (!purchaseInvoiceNumberResult.rows || purchaseInvoiceNumberResult.rows.length === 0) {
      throw new Error('No purchase invoice number generated');
    }

    const purchaseInvoiceNumber = purchaseInvoiceNumberResult.rows[0].purchase_invoice_number;
    console.log('Generated purchase invoice number:', purchaseInvoiceNumber);

    res.json({
      success: true,
      data: {
        purchaseInvoiceNumber
      }
    });
  } catch (error) {
    console.error('Error generating purchase invoice number:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate purchase invoice number',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all purchase invoices for authenticated user's business
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
      SELECT pi.*, u.first_name, u.last_name,
             COUNT(pil.id) as line_count
      FROM purchase_invoices pi
      LEFT JOIN users u ON pi.created_by = u.id
      LEFT JOIN purchase_invoice_lines pil ON pi.id = pil.purchase_invoice_id
      WHERE pi.business_id = $1
    `;
    const queryParams: any[] = [businessId];
    let paramIndex = 2;

    // Add search filter
    if (search) {
      query += ` AND (pi.purchase_invoice_number ILIKE $${paramIndex} OR pi.supplier_name ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Add status filter
    if (status) {
      query += ` AND pi.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    query += ` GROUP BY pi.id, u.first_name, u.last_name`;

    // Add pagination
    const offset = (Number(page) - 1) * Number(limit);
    query += ` ORDER BY pi.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(Number(limit), offset);

    const result = await pool.query(query, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT pi.id) as total
      FROM purchase_invoices pi
      WHERE pi.business_id = $1
    `;
    const countParams: any[] = [businessId];
    let countParamIndex = 2;

    if (search) {
      countQuery += ` AND (pi.purchase_invoice_number ILIKE $${countParamIndex} OR pi.supplier_name ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    if (status) {
      countQuery += ` AND pi.status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: {
        purchase_invoices: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching purchase invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase invoices',
      error: error.message
    });
  }
});

// Get purchase invoice by ID
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    console.log('🔵 [PurchaseInvoiceRoutes] GET /:id - Request received');
    const businessId = req.user?.business_id;
    const purchaseInvoiceId = parseInt(req.params.id);
    console.log('🔵 [PurchaseInvoiceRoutes] Purchase invoice ID:', purchaseInvoiceId, 'Business ID:', businessId);

    if (!businessId) {
      console.error('❌ [PurchaseInvoiceRoutes] No business ID found');
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    // Get purchase invoice details
    console.log('🔵 [PurchaseInvoiceRoutes] Querying purchase_invoices table...');
    const purchaseInvoiceResult = await pool.query(
      `SELECT pi.*, u.first_name, u.last_name
       FROM purchase_invoices pi
       LEFT JOIN users u ON pi.created_by = u.id
       WHERE pi.id = $1 AND pi.business_id = $2`,
      [purchaseInvoiceId, businessId]
    );

    console.log('🔵 [PurchaseInvoiceRoutes] Purchase invoice query result:', purchaseInvoiceResult.rows.length, 'rows');

    if (purchaseInvoiceResult.rows.length === 0) {
      console.error('❌ [PurchaseInvoiceRoutes] Purchase invoice not found');
      return res.status(404).json({
        success: false,
        message: 'Purchase invoice not found'
      });
    }

    const purchaseInvoice = purchaseInvoiceResult.rows[0];
    console.log('🔵 [PurchaseInvoiceRoutes] Purchase invoice found:', purchaseInvoice.purchase_invoice_number);

    // Get purchase invoice lines
    console.log('🔵 [PurchaseInvoiceRoutes] Querying purchase_invoice_lines table...');
    const linesResult = await pool.query(
      `SELECT pil.*, i.name as item_name
       FROM purchase_invoice_lines pil
       LEFT JOIN items i ON pil.item_id = i.id
       WHERE pil.purchase_invoice_id = $1
       ORDER BY pil.id`,
      [purchaseInvoiceId]
    );
    console.log('🔵 [PurchaseInvoiceRoutes] Lines query result:', linesResult.rows.length, 'lines');

    // Get payment information (financial account ID from payment record)
    console.log('🔵 [PurchaseInvoiceRoutes] Querying purchase_invoice_payments table...');
    const paymentResult = await pool.query(
      `SELECT financial_account_id, amount, payment_method, payment_reference
       FROM purchase_invoice_payments
       WHERE purchase_invoice_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [purchaseInvoiceId]
    );
    console.log('🔵 [PurchaseInvoiceRoutes] Payment query result:', paymentResult.rows.length, 'payments');

    const paymentData = paymentResult.rows.length > 0 ? paymentResult.rows[0] : null;
    const financialAccountId = paymentData?.financial_account_id || null;

    console.log('🔵 [PurchaseInvoiceRoutes] Financial account ID:', financialAccountId);

    res.json({
      success: true,
      data: {
        ...purchaseInvoice,
        lines: linesResult.rows,
        financial_account_id: financialAccountId,
        amountPaid: purchaseInvoice.amount_paid || 0
      }
    });
    console.log('✅ [PurchaseInvoiceRoutes] Purchase invoice data sent successfully');
  } catch (error: any) {
    console.error('❌ [PurchaseInvoiceRoutes] Error fetching purchase invoice:', error);
    console.error('❌ [PurchaseInvoiceRoutes] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase invoice',
      error: error.message
    });
  }
});

// Create new purchase invoice
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const client = await pool.connect();
  
  try {
    const businessId = req.businessId || req.user?.business_id;
    const userId = req.userId || req.user?.id;

    if (!businessId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    const {
      supplier_id,
      supplier_name,
      supplier_address,
      supplier_pin,
      lines,
      notes,
      due_date,
      payment_terms = 'Net 30 Days',
      payment_method = 'Cash',
      mpesa_code,
      amountPaid = 0,
      paymentMethod,
      discount_amount = 0,
      vat_amount,
      affectFinancialAccount = true // Default to true if not provided (backward compatibility)
    } = req.body;

    // Validate required fields
    if (!supplier_name || !lines || lines.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Supplier name and purchase invoice lines are required'
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

    // Generate purchase invoice number
    const businessResult = await client.query('SELECT name FROM businesses WHERE id = $1', [businessId]);
    const businessName = businessResult.rows[0]?.name || 'BUS';
    const businessPrefix = 'PI-' + businessName.substring(0, 3).toUpperCase() + '-';
    
    const purchaseInvoiceNumberResult = await client.query(
      'SELECT generate_purchase_invoice_number($1) as purchase_invoice_number',
      [businessPrefix]
    );
    const purchaseInvoiceNumber = purchaseInvoiceNumberResult.rows[0].purchase_invoice_number;

    // Calculate totals
    let subtotal = 0;
    for (const line of lines) {
      subtotal += line.quantity * line.unit_price;
    }
    const calculatedVatAmount = vat_amount !== undefined ? parseFloat(String(vat_amount)) : (subtotal * 0.16);
    const discountAmount = parseFloat(String(discount_amount)) || 0;
    const total_before_discount = subtotal + calculatedVatAmount;
    const total_before_rounding = Math.max(0, total_before_discount - discountAmount);
    const total_amount = Math.round(total_before_rounding);

    // Calculate actual_amount_paid and change_received
    const actualAmountPaid = Math.min(total_amount, parsedAmountPaid);
    const changeReceived = Math.max(0, parsedAmountPaid - total_amount);

    // Determine payment status and purchase invoice status
    let paymentStatus = 'unpaid';
    let purchaseInvoiceStatus = 'sent';
    
    if (parsedAmountPaid >= total_amount) {
      paymentStatus = 'paid';
      purchaseInvoiceStatus = 'paid';
    } else if (parsedAmountPaid > 0) {
      paymentStatus = 'partial';
      purchaseInvoiceStatus = 'partially_paid';
    } else {
      paymentStatus = 'unpaid';
      purchaseInvoiceStatus = 'sent';
    }

    // Create purchase invoice with issue_date as today's date
    const issueDate = new Date().toISOString().split('T')[0];
    
    const purchaseInvoiceResult = await client.query(`
      INSERT INTO purchase_invoices (
        business_id, purchase_invoice_number, supplier_id, supplier_name, supplier_address, supplier_pin,
        subtotal, vat_amount, discount, total_amount, amount_paid, actual_amount_paid, change_received, payment_status, status, payment_method, mpesa_code,
        notes, due_date, payment_terms, created_by, issue_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *
    `, [
      businessId, purchaseInvoiceNumber, supplier_id || null, supplier_name, supplier_address, supplier_pin,
      subtotal, calculatedVatAmount, discountAmount, total_amount, parsedAmountPaid, actualAmountPaid, changeReceived, paymentStatus, purchaseInvoiceStatus, payment_method || 'Cash', 
      mpesa_code || null, notes, due_date, payment_terms, userId, issueDate
    ]);

    const purchaseInvoice = purchaseInvoiceResult.rows[0];

    // Create purchase invoice lines and update stock (INCREASE quantity for purchases)
    for (const line of lines) {
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
        }
      }
      
      // Check if category columns exist
      const columnCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'purchase_invoice_lines'
          AND column_name = 'category_id'
        );
      `);
      const hasCategoryColumns = columnCheck.rows[0]?.exists || false;

      if (hasCategoryColumns) {
        await client.query(`
          INSERT INTO purchase_invoice_lines (
            purchase_invoice_id, item_id, quantity, unit_price, total, description, code, uom,
            category_id, category_1_id, category_2_id, category_name, category_1_name, category_2_name
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          purchaseInvoice.id, itemId, quantity, unitPrice,
          quantity * unitPrice, line.description, line.code, line.uom,
          categoryData.category_id, categoryData.category_1_id, categoryData.category_2_id,
          categoryData.category_name, categoryData.category_1_name, categoryData.category_2_name
        ]);
      } else {
        await client.query(`
          INSERT INTO purchase_invoice_lines (
            purchase_invoice_id, item_id, quantity, unit_price, total, description, code, uom
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          purchaseInvoice.id, itemId, quantity, unitPrice,
          quantity * unitPrice, line.description, line.code, line.uom
        ]);
      }

      // Update stock quantity (INCREASE stock for purchase invoice) - only if item_id is provided
      // Cast quantity to INTEGER since items.quantity is INTEGER
      if (itemId && !isNaN(itemId)) {
        const quantityInt = Math.floor(quantity);
        await client.query(`
          UPDATE items 
          SET quantity = quantity + $1 
          WHERE id = $2 AND business_id = $3
        `, [quantityInt, itemId, businessId]);
      }
    }

    // If payment is made and a financial account is selected AND affectFinancialAccount is true, update the account balance
    // For purchase invoices: DECREASE balance by amount paid (money going out - expense)
    if (parsedAmountPaid > 0 && financialAccountId !== null && !isNaN(financialAccountId) && affectFinancialAccount === true) {
      // Update financial account balance (decrease by amount paid)
      await client.query(`
        UPDATE financial_accounts 
        SET current_balance = current_balance - $1, updated_at = NOW()
        WHERE id = $2 AND business_id = $3
      `, [parsedAmountPaid, financialAccountId, businessId]);

      // Map payment_method to valid constraint values
      let validPaymentMethod = 'cash';
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
        INSERT INTO purchase_invoice_payments (
          purchase_invoice_id, financial_account_id, amount, payment_method, 
          payment_reference, payment_date, business_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
      `, [
        purchaseInvoice.id, financialAccountId, parsedAmountPaid, validPaymentMethod,
        `PI-${purchaseInvoiceNumber}`, businessId, userId
      ]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Purchase invoice created successfully',
      data: {
        ...purchaseInvoice,
        lines
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating purchase invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create purchase invoice'
    });
  } finally {
    client.release();
  }
});

// Update purchase invoice
router.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const client = await pool.connect();
  
  try {
    const businessId = req.user?.business_id;
    const userId = req.user?.id;
    const purchaseInvoiceId = parseInt(req.params.id);

    if (!businessId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    const {
      supplier_name,
      supplier_address,
      supplier_pin,
      lines,
      notes,
      due_date,
      payment_terms,
      discount_amount = 0,
      vat_amount,
      amountPaid = 0,
      paymentMethod,
      affectFinancialAccount = true // Default to true if not provided (backward compatibility)
    } = req.body;

    await client.query('BEGIN');

    // Get existing purchase invoice to restore quantities
    const existingPurchaseInvoice = await client.query(
      'SELECT * FROM purchase_invoices WHERE id = $1 AND business_id = $2',
      [purchaseInvoiceId, businessId]
    );

    if (existingPurchaseInvoice.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Purchase invoice not found'
      });
    }

    // Get existing lines and restore item quantities (decrease by old quantities)
    const existingLines = await client.query(
      'SELECT * FROM purchase_invoice_lines WHERE purchase_invoice_id = $1',
      [purchaseInvoiceId]
    );

    for (const oldLine of existingLines.rows) {
      if (oldLine.item_id) {
        // Cast quantity to INTEGER since items.quantity is INTEGER and purchase_invoice_lines.quantity is DECIMAL
        const oldQuantity = Math.floor(parseFloat(String(oldLine.quantity)) || 0);
        await client.query(`
          UPDATE items 
          SET quantity = quantity - $1 
          WHERE id = $2 AND business_id = $3
        `, [oldQuantity, oldLine.item_id, businessId]);
      }
    }

    // Delete old lines
    await client.query('DELETE FROM purchase_invoice_lines WHERE purchase_invoice_id = $1', [purchaseInvoiceId]);

    // Calculate new totals
    let subtotal = 0;
    for (const line of lines) {
      subtotal += line.quantity * line.unit_price;
    }
    const calculatedVatAmount = vat_amount !== undefined ? parseFloat(String(vat_amount)) : (subtotal * 0.16);
    const discountAmount = parseFloat(String(discount_amount)) || 0;
    const total_before_discount = subtotal + calculatedVatAmount;
    const total_before_rounding = Math.max(0, total_before_discount - discountAmount);
    const total_amount = Math.round(total_before_rounding);

    // Update purchase invoice
    await client.query(`
      UPDATE purchase_invoices 
      SET supplier_name = $1, supplier_address = $2, supplier_pin = $3,
          subtotal = $4, vat_amount = $5, discount = $6, total_amount = $7,
          notes = $8, due_date = $9, payment_terms = $10, updated_at = CURRENT_TIMESTAMP
      WHERE id = $11 AND business_id = $12
      RETURNING *
    `, [
      supplier_name, supplier_address, supplier_pin,
      subtotal, calculatedVatAmount, discountAmount, total_amount,
      notes, due_date, payment_terms, purchaseInvoiceId, businessId
    ]);

    // Create new lines and update quantities (increase by new quantities)
    for (const line of lines) {
      const itemId = line.item_id ? (isNaN(Number(line.item_id)) ? null : parseInt(String(line.item_id))) : null;
      const quantity = parseFloat(String(line.quantity));
      const unitPrice = parseFloat(String(line.unit_price));

      await client.query(`
        INSERT INTO purchase_invoice_lines (
          purchase_invoice_id, item_id, quantity, unit_price, total, description, code, uom
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        purchaseInvoiceId, itemId, quantity, unitPrice,
        quantity * unitPrice, line.description, line.code, line.uom
      ]);

      // Update stock quantity (INCREASE for purchase)
      // Cast quantity to INTEGER since items.quantity is INTEGER
      if (itemId && !isNaN(itemId)) {
        const quantityInt = Math.floor(quantity);
        await client.query(`
          UPDATE items 
          SET quantity = quantity + $1 
          WHERE id = $2 AND business_id = $3
        `, [quantityInt, itemId, businessId]);
      }
    }

    // Handle payment updates if amountPaid and paymentMethod are provided
    const parsedAmountPaid = parseFloat(String(amountPaid)) || 0;
    let financialAccountId: number | null = null;
    if (paymentMethod) {
      const parsedPaymentMethod = typeof paymentMethod === 'string' 
        ? (isNaN(Number(paymentMethod)) ? null : parseInt(String(paymentMethod)))
        : (isNaN(Number(paymentMethod)) ? null : parseInt(String(paymentMethod)));
      
      if (parsedPaymentMethod !== null && !isNaN(parsedPaymentMethod) && parsedPaymentMethod > 0) {
        financialAccountId = parsedPaymentMethod;
      }
    }

    // Delete existing payment records for this purchase invoice
    await client.query('DELETE FROM purchase_invoice_payments WHERE purchase_invoice_id = $1', [purchaseInvoiceId]);

    // If payment is made and a financial account is selected AND affectFinancialAccount is true, update the account balance
    // For purchase invoices: DECREASE balance by amount paid (money going out - expense)
    if (parsedAmountPaid > 0 && financialAccountId !== null && !isNaN(financialAccountId) && affectFinancialAccount === true) {
      // Update financial account balance (decrease by amount paid)
      await client.query(`
        UPDATE financial_accounts 
        SET current_balance = current_balance - $1, updated_at = NOW()
        WHERE id = $2 AND business_id = $3
      `, [parsedAmountPaid, financialAccountId, businessId]);

      // Determine payment method type
      let validPaymentMethod = 'cash';
      const paymentMethodStr = String(payment_terms || '').toLowerCase();
      if (paymentMethodStr.includes('mpesa') || paymentMethodStr.includes('m-pesa') || paymentMethodStr === 'mobile_money') {
        validPaymentMethod = 'mobile_money';
      } else if (paymentMethodStr.includes('bank')) {
        validPaymentMethod = 'bank';
      } else if (paymentMethodStr.includes('cheque') || paymentMethodStr.includes('check')) {
        validPaymentMethod = 'cheque';
      } else if (paymentMethodStr.includes('card')) {
        validPaymentMethod = 'card';
      }

      // Create a payment record for audit trail
      const purchaseInvoiceNumber = existingPurchaseInvoice.rows[0].purchase_invoice_number;
      await client.query(`
        INSERT INTO purchase_invoice_payments (
          purchase_invoice_id, financial_account_id, amount, payment_method, 
          payment_reference, payment_date, business_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
      `, [
        purchaseInvoiceId, financialAccountId, parsedAmountPaid, validPaymentMethod,
        `PI-${purchaseInvoiceNumber}`, businessId, userId
      ]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Purchase invoice updated successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating purchase invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update purchase invoice'
    });
  } finally {
    client.release();
  }
});

// Delete purchase invoice
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const client = await pool.connect();
  
  try {
    const businessId = req.user?.business_id;
    const purchaseInvoiceId = parseInt(req.params.id);

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'No business associated with this account'
      });
    }

    await client.query('BEGIN');

    // Get purchase invoice lines to restore quantities
    const linesResult = await client.query(
      'SELECT * FROM purchase_invoice_lines WHERE purchase_invoice_id = $1',
      [purchaseInvoiceId]
    );

    // Restore item quantities (decrease by purchase quantities)
    for (const line of linesResult.rows) {
      if (line.item_id) {
        await client.query(`
          UPDATE items 
          SET quantity = quantity - $1 
          WHERE id = $2 AND business_id = $3
        `, [line.quantity, line.item_id, businessId]);
      }
    }

    // Delete purchase invoice (cascade will delete lines and payments)
    const result = await client.query(
      'DELETE FROM purchase_invoices WHERE id = $1 AND business_id = $2 RETURNING *',
      [purchaseInvoiceId, businessId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Purchase invoice not found'
      });
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Purchase invoice deleted successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting purchase invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete purchase invoice'
    });
  } finally {
    client.release();
  }
});

export default router;

