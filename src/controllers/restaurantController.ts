import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import pool from '../database/connection';
import { Invoice, InvoiceLine } from '../types';

/**
 * Simple bar/restaurant module built on top of existing items and invoices.
 *
 * Tables:
 * - restaurant_spaces
 * - restaurant_tables
 * - restaurant_orders
 * - restaurant_order_items
 *
 * This controller intentionally keeps the logic simple:
 * - Orders live in restaurant_orders/restaurant_order_items while they are "open"
 * - When billed, we create a normal invoice using the existing invoices logic and
 *   store the invoice_id on restaurant_orders.
 */

export const getSpacesAndTables = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.user?.business_id;
    if (!businessId) {
      return res.status(400).json({ success: false, message: 'No business associated with this account' });
    }

    const spacesResult = await pool.query(
      `SELECT * FROM restaurant_spaces WHERE business_id = $1 ORDER BY id`,
      [businessId],
    );

    const tablesResult = await pool.query(
      `SELECT t.*, s.title as space_title
       FROM restaurant_tables t
       LEFT JOIN restaurant_spaces s ON t.space_id = s.id
       WHERE t.business_id = $1
       ORDER BY s.title, t.table_no`,
      [businessId],
    );

    const openOrdersResult = await pool.query(
      `SELECT o.*, t.table_no, t.label,
              COALESCE(SUM(oi.quantity * oi.unit_price), 0) as total_amount,
              COUNT(oi.id) as item_count
       FROM restaurant_orders o
       LEFT JOIN restaurant_order_items oi ON oi.order_id = o.id
       LEFT JOIN restaurant_tables t ON t.id = o.table_id
       WHERE o.business_id = $1 AND o.status IN ('open','sent')
       GROUP BY o.id, t.table_no, t.label
       ORDER BY o.updated_at DESC`,
      [businessId],
    );

    console.log('🍽️ [RESTAURANT] Loaded spaces:', spacesResult.rows.length, 'tables:', tablesResult.rows.length, 'openOrders:', openOrdersResult.rows.length);

    return res.json({
      success: true,
      data: {
        spaces: spacesResult.rows,
        tables: tablesResult.rows,
        openOrders: openOrdersResult.rows,
      },
    });
  } catch (error) {
    console.error('❌ [RESTAURANT] Error fetching spaces/tables:', error);

    // If tables are missing, give a clearer message
    // Postgres error code 42P01 = undefined_table
    const pgError: any = error;
    if (pgError?.code === '42P01') {
      return res.status(500).json({
        success: false,
        message:
          'Restaurant tables are missing in the database. Please run the latest SQL migration (037_create_restaurant_module.sql) on both Neon and local PostgreSQL.',
        code: pgError.code,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to load restaurant spaces and tables',
      error: pgError?.message || 'Unknown error',
    });
  }
};

export const createSpace = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.user?.business_id;
    if (!businessId) {
      return res.status(400).json({ success: false, message: 'No business associated with this account' });
    }

    const { title, code, show_unrestricted_items = true } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: 'Space title is required' });
    }

    const result = await pool.query(
      `INSERT INTO restaurant_spaces (business_id, title, code, show_unrestricted_items)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [businessId, title, code || null, !!show_unrestricted_items],
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating restaurant space:', error);
    return res.status(500).json({ success: false, message: 'Failed to create space' });
  }
};

export const createTable = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.user?.business_id;
    if (!businessId) {
      return res.status(400).json({ success: false, message: 'No business associated with this account' });
    }

    const { table_no, size, shape, space_id, label } = req.body;
    if (!table_no || !space_id) {
      return res.status(400).json({ success: false, message: 'Table number and space are required' });
    }

    const result = await pool.query(
      `INSERT INTO restaurant_tables (business_id, space_id, table_no, size, shape, label)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [businessId, space_id, table_no, size || 4, shape || 'rectangle', label || null],
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating restaurant table:', error);
    return res.status(500).json({ success: false, message: 'Failed to create table' });
  }
};

// Create or update an order for a table (used for "Send Order" from waiter UI)
export const saveOrder = async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();

  try {
    const businessId = req.user?.business_id;
    const userId = req.user?.id;

    if (!businessId || !userId) {
      return res.status(400).json({ success: false, message: 'Authentication required' });
    }

    const {
      order_id,
      table_id,
      items,
      note,
    } = req.body as {
      order_id?: number;
      table_id: number;
      note?: string;
      items: Array<{
        item_id: number;
        quantity: number;
        unit_price: number;
        description?: string;
        code?: string;
        uom?: string;
      }>;
    };

    if (!table_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Table and at least one item are required' });
    }

    await client.query('BEGIN');

    let order;
    if (order_id) {
      const existing = await client.query(
        `UPDATE restaurant_orders
         SET note = $1, status = 'sent', updated_at = NOW()
         WHERE id = $2 AND business_id = $3
         RETURNING *`,
        [note || null, order_id, businessId],
      );
      if (existing.rows.length === 0) {
        throw new Error('Order not found');
      }
      order = existing.rows[0];

      await client.query('DELETE FROM restaurant_order_items WHERE order_id = $1', [order_id]);
    } else {
      const inserted = await client.query(
        `INSERT INTO restaurant_orders (business_id, table_id, status, note, created_by)
         VALUES ($1, $2, 'sent', $3, $4)
         RETURNING *`,
        [businessId, table_id, note || null, userId],
      );
      order = inserted.rows[0];
    }

    for (const item of items) {
      const quantity = parseFloat(String(item.quantity)) || 0;
      const unitPrice = parseFloat(String(item.unit_price)) || 0;
      if (!item.item_id || quantity <= 0 || unitPrice < 0) continue;

      await client.query(
        `INSERT INTO restaurant_order_items
         (order_id, item_id, quantity, unit_price, description, code, uom)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          order.id,
          item.item_id,
          quantity,
          unitPrice,
          item.description || '',
          item.code || '',
          item.uom || '',
        ],
      );
    }

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Order saved successfully',
      data: order,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving restaurant order:', error);
    return res.status(500).json({ success: false, message: 'Failed to save order' });
  } finally {
    client.release();
  }
};

// List orders for counter screen
export const getOpenOrders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.user?.business_id;
    if (!businessId) {
      return res.status(400).json({ success: false, message: 'No business associated with this account' });
    }

    const result = await pool.query(
      `SELECT o.*, t.table_no, t.label, s.title as space_title,
              COALESCE(SUM(oi.quantity * oi.unit_price), 0) as total_amount,
              COUNT(oi.id) as item_count
       FROM restaurant_orders o
       LEFT JOIN restaurant_order_items oi ON oi.order_id = o.id
       LEFT JOIN restaurant_tables t ON t.id = o.table_id
       LEFT JOIN restaurant_spaces s ON s.id = t.space_id
       WHERE o.business_id = $1 AND o.status IN ('open','sent')
       GROUP BY o.id, t.table_no, t.label, s.title
       ORDER BY o.updated_at DESC`,
      [businessId],
    );

    return res.json({ success: true, data: { orders: result.rows } });
  } catch (error) {
    console.error('Error fetching open restaurant orders:', error);
    return res.status(500).json({ success: false, message: 'Failed to load orders' });
  }
};

// Get single order with items (used when opening order from counter screen)
export const getOrderDetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.user?.business_id;
    const { id } = req.params;

    if (!businessId) {
      return res.status(400).json({ success: false, message: 'No business associated with this account' });
    }

    const orderResult = await pool.query(
      `SELECT o.*, t.table_no, t.label, s.title as space_title
       FROM restaurant_orders o
       LEFT JOIN restaurant_tables t ON t.id = o.table_id
       LEFT JOIN restaurant_spaces s ON s.id = t.space_id
       WHERE o.id = $1 AND o.business_id = $2`,
      [id, businessId],
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const itemsResult = await pool.query(
      `SELECT oi.*, it.name as item_name
       FROM restaurant_order_items oi
       LEFT JOIN items it ON it.id = oi.item_id
       WHERE oi.order_id = $1`,
      [id],
    );

    return res.json({
      success: true,
      data: {
        order: orderResult.rows[0],
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    console.error('Error fetching restaurant order details:', error);
    return res.status(500).json({ success: false, message: 'Failed to load order details' });
  }
};

// Bill an order: create a normal invoice and link it to the restaurant order
export const billOrder = async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();

  try {
    const businessId = req.user?.business_id;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!businessId || !userId) {
      return res.status(400).json({ success: false, message: 'Authentication required' });
    }

    const {
      lines,
      amountPaid = 0,
      paymentMethod,
      payment_terms = 'Cash',
      mpesa_code,
      vat_amount,
      discount_amount = 0,
    } = req.body as {
      lines: Array<{
        item_id: number;
        quantity: number;
        unit_price: number;
        description?: string;
        code?: string;
        uom?: string;
      }>;
      amountPaid?: number;
      paymentMethod?: number | string | null;
      payment_terms?: string;
      mpesa_code?: string;
      vat_amount?: number;
      discount_amount?: number;
    };

    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one line item is required' });
    }

    await client.query('BEGIN');

    // Ensure order exists and belongs to business (lock only the base row)
    const orderResult = await client.query(
      `SELECT *
       FROM restaurant_orders
       WHERE id = $1 AND business_id = $2
       FOR UPDATE`,
      [id, businessId],
    );

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Fetch table/space information without row locking
    const tableInfoResult = await client.query(
      `SELECT t.table_no, t.label, s.title as space_title
       FROM restaurant_tables t
       LEFT JOIN restaurant_spaces s ON s.id = t.space_id
       WHERE t.id = $1`,
      [order.table_id],
    );
    const tableInfo = tableInfoResult.rows[0] || {};

    // Generate invoice number using same helper as invoices route
    const businessResult = await client.query('SELECT name FROM businesses WHERE id = $1', [businessId]);
    const businessName = businessResult.rows[0]?.name || 'BUS';
    const businessPrefix = businessName.substring(0, 3).toUpperCase();
    const invoiceNumberResult = await client.query(
      'SELECT generate_invoice_number($1) as invoice_number',
      [businessPrefix],
    );
    const invoiceNumber = invoiceNumberResult.rows[0].invoice_number;

    // Calculate totals
    let subtotal = 0;
    for (const line of lines) {
      subtotal += parseFloat(String(line.quantity)) * parseFloat(String(line.unit_price));
    }
    const calculatedVatAmount =
      vat_amount !== undefined ? parseFloat(String(vat_amount)) : subtotal * 0.16;
    const discountAmount = parseFloat(String(discount_amount)) || 0;
    const totalBeforeDiscount = subtotal + calculatedVatAmount;
    const total_before_rounding = Math.max(0, totalBeforeDiscount - discountAmount);
    const total_amount = Math.round(total_before_rounding);

    const parsedAmountPaid = parseFloat(String(amountPaid)) || 0;
    const actualAmountReceived = Math.min(total_amount, parsedAmountPaid);
    const changeGiven = Math.max(0, parsedAmountPaid - total_amount);

    let paymentStatus = 'unpaid';
    let invoiceStatus = 'sent';

    if (parsedAmountPaid >= total_amount) {
      paymentStatus = 'paid';
      invoiceStatus = 'paid';
    } else if (parsedAmountPaid > 0) {
      paymentStatus = 'partial';
      invoiceStatus = 'partially_paid';
    }

    // Resolve financial account from paymentMethod
    let financialAccountId: number | null = null;
    if (paymentMethod) {
      const parsed = isNaN(Number(paymentMethod))
        ? null
        : parseInt(String(paymentMethod), 10);
      if (parsed && parsed > 0) {
        financialAccountId = parsed;
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const customerName = `Table ${tableInfo.table_no || ''} - ${tableInfo.space_title || 'Restaurant'}`.trim();

    const invoiceInsert = await client.query(
      `
      INSERT INTO invoices (
        business_id, invoice_number, customer_name, customer_address, customer_pin,
        subtotal, vat_amount, discount, total_amount, amount_paid, actual_amount_received, change_given,
        payment_status, status, payment_method, mpesa_code,
        quotation_id, notes, due_date, payment_terms, created_by, issue_date
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16,
        NULL, $17, $18, $19, $20, $21
      )
      RETURNING *
      `,
      [
        businessId,
        invoiceNumber,
        customerName,
        '',
        '',
        subtotal,
        calculatedVatAmount,
        discountAmount,
        total_amount,
        parsedAmountPaid,
        actualAmountReceived,
        changeGiven,
        paymentStatus,
        invoiceStatus,
        payment_terms || 'Cash',
        mpesa_code || null,
        `Restaurant order #${order.id}`,
        today,
        payment_terms || 'Cash',
        userId,
        today,
      ],
    );

    const invoice: Invoice = invoiceInsert.rows[0];

    // Insert invoice lines and update stock
    for (const line of lines) {
      const itemId = line.item_id ? parseInt(String(line.item_id), 10) : null;
      const quantity = parseFloat(String(line.quantity)) || 0;
      const unitPrice = parseFloat(String(line.unit_price)) || 0;
      const total = quantity * unitPrice;

      await client.query(
        `
        INSERT INTO invoice_lines (
          invoice_id, item_id, quantity, unit_price, total, description, code, uom
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          invoice.id,
          itemId,
          quantity,
          unitPrice,
          total,
          line.description || '',
          line.code || '',
          line.uom || '',
        ],
      );

      if (itemId && !isNaN(itemId)) {
        const quantityInt = Math.round(quantity);
        await client.query(
          `
          UPDATE items
          SET quantity = quantity - $1
          WHERE id = $2 AND business_id = $3
          `,
          [quantityInt, itemId, businessId],
        );
      }
    }

    // Update financial account balance and create payment record if paid
    if (parsedAmountPaid > 0 && financialAccountId) {
      await client.query(
        `
        UPDATE financial_accounts
        SET current_balance = current_balance + $1, updated_at = NOW()
        WHERE id = $2 AND business_id = $3
        `,
        [parsedAmountPaid, financialAccountId, businessId],
      );

      let validPaymentMethod = 'cash';
      const paymentMethodStr = String(payment_terms || '').toLowerCase();
      if (paymentMethodStr.includes('mpesa') || paymentMethodStr.includes('m-pesa')) {
        validPaymentMethod = 'mobile_money';
      } else if (paymentMethodStr.includes('bank')) {
        validPaymentMethod = 'bank';
      } else if (paymentMethodStr.includes('cheque') || paymentMethodStr.includes('check')) {
        validPaymentMethod = 'cheque';
      } else if (paymentMethodStr.includes('card')) {
        validPaymentMethod = 'card';
      }

      await client.query(
        `
        INSERT INTO invoice_payments (
          invoice_id, financial_account_id, amount, payment_method,
          payment_reference, payment_date, business_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
        `,
        [
          invoice.id,
          financialAccountId,
          parsedAmountPaid,
          validPaymentMethod,
          `REST-${invoiceNumber}`,
          businessId,
          userId,
        ],
      );
    }

    // Mark restaurant order as billed
    await client.query(
      `
      UPDATE restaurant_orders
      SET status = 'billed', invoice_id = $1, updated_at = NOW()
      WHERE id = $2 AND business_id = $3
      `,
      [invoice.id, id, businessId],
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Order billed successfully',
      data: {
        invoice,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error billing restaurant order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to bill order',
    });
  } finally {
    client.release();
  }
};


