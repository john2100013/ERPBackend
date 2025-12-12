import { Response } from 'express';
import pool from '../database/connection';
import { AuthenticatedRequest } from '../middleware/auth';

// Record a service transaction
export const recordTransaction = async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  
  try {
    const businessId = req.businessId;
    const cashierId = req.user?.id;
    const { 
      shift_id, 
      employee_id, 
      service_id, 
      customer_name, 
      customer_phone, 
      service_price, 
      payment_method,
      products_used 
    } = req.body;

    await client.query('BEGIN');

    // Get service details and employee commission rate
    const serviceResult = await client.query(
      'SELECT base_price FROM salon_services WHERE id = $1',
      [service_id]
    );

    const employeeResult = await client.query(
      'SELECT commission_rate FROM salon_users WHERE user_id = $1 AND business_id = $2',
      [employee_id, businessId]
    );

    if (serviceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    if (employeeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const commission_rate = parseFloat(employeeResult.rows[0].commission_rate) || 0;
    const employee_commission = (parseFloat(service_price) * commission_rate) / 100;

    // Insert transaction
    const transactionResult = await client.query(
      `INSERT INTO salon_transactions 
       (business_id, shift_id, employee_id, cashier_id, service_id, customer_name, customer_phone, service_price, payment_method, employee_commission)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [businessId, shift_id, employee_id, cashierId, service_id, customer_name, customer_phone, service_price, payment_method, employee_commission]
    );

    const transaction = transactionResult.rows[0];

    // Record product usage if any
    if (products_used && Array.isArray(products_used) && products_used.length > 0) {
      for (const product of products_used) {
        // Insert product usage
        await client.query(
          `INSERT INTO salon_product_usage (transaction_id, product_id, quantity_used, cost)
           VALUES ($1, $2, $3, $4)`,
          [transaction.id, product.product_id, product.quantity_used, product.cost || 0]
        );

        // Update product stock
        await client.query(
          `UPDATE salon_products 
           SET current_stock = current_stock - $1
           WHERE id = $2 AND business_id = $3`,
          [product.quantity_used, product.product_id, businessId]
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error recording transaction:', error);
    res.status(500).json({ success: false, message: 'Failed to record transaction' });
  } finally {
    client.release();
  }
};

// Get transactions
export const getTransactions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessId;
    const { employee_id, shift_id, start_date, end_date, payment_method } = req.query;

    let query = `
      SELECT t.*,
             CONCAT(e.first_name, ' ', e.last_name) as employee_name,
             CONCAT(c.first_name, ' ', c.last_name) as cashier_name,
             srv.name as service_name,
             srv.base_price
      FROM salon_transactions t
      JOIN users e ON t.employee_id = e.id
      JOIN users c ON t.cashier_id = c.id
      JOIN salon_services srv ON t.service_id = srv.id
      WHERE t.business_id = $1
    `;
    const params: any[] = [businessId];
    let paramCount = 1;

    if (employee_id) {
      paramCount++;
      query += ` AND t.employee_id = $${paramCount}`;
      params.push(employee_id);
    }

    if (shift_id) {
      paramCount++;
      query += ` AND t.shift_id = $${paramCount}`;
      params.push(shift_id);
    }

    if (start_date) {
      paramCount++;
      query += ` AND t.transaction_date >= $${paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      query += ` AND t.transaction_date <= $${paramCount}`;
      params.push(end_date);
    }

    if (payment_method) {
      paramCount++;
      query += ` AND t.payment_method = $${paramCount}`;
      params.push(payment_method);
    }

    query += ' ORDER BY t.transaction_date DESC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch transactions' });
  }
};

// Get transaction details with products used
export const getTransactionDetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.businessId;

    const transactionResult = await pool.query(
      `SELECT t.*,
              CONCAT(e.first_name, ' ', e.last_name) as employee_name,
              CONCAT(c.first_name, ' ', c.last_name) as cashier_name,
              srv.name as service_name,
              srv.base_price
       FROM salon_transactions t
       JOIN users e ON t.employee_id = e.id
       JOIN users c ON t.cashier_id = c.id
       JOIN salon_services srv ON t.service_id = srv.id
       WHERE t.id = $1 AND t.business_id = $2`,
      [id, businessId]
    );

    if (transactionResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const productsResult = await pool.query(
      `SELECT pu.*, p.name as product_name, p.unit
       FROM salon_product_usage pu
       JOIN salon_products p ON pu.product_id = p.id
       WHERE pu.transaction_id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: {
        transaction: transactionResult.rows[0],
        products_used: productsResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch transaction details' });
  }
};

// Get employee performance
export const getEmployeePerformance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessId;
    const { start_date, end_date } = req.query;

    let dateFilter = '';
    const params: any[] = [businessId];
    let paramCount = 1;

    if (start_date) {
      paramCount++;
      dateFilter += ` AND t.transaction_date >= $${paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      dateFilter += ` AND t.transaction_date <= $${paramCount}`;
      params.push(end_date);
    }

    const query = `
      SELECT 
        e.id as employee_id,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.email,
        su.commission_rate,
        COUNT(t.id) as total_clients,
        COALESCE(SUM(t.service_price), 0) as total_revenue,
        COALESCE(SUM(t.employee_commission), 0) as total_earnings
      FROM users e
      JOIN salon_users su ON e.id = su.user_id
      LEFT JOIN salon_transactions t ON e.id = t.employee_id AND t.business_id = $1${dateFilter}
      WHERE su.business_id = $1 AND su.role = 'employee' AND su.is_active = TRUE
      GROUP BY e.id, e.first_name, e.last_name, e.email, su.commission_rate
      ORDER BY total_revenue DESC
    `;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching employee performance:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch employee performance' });
  }
};

// Get dashboard stats
export const getDashboardStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessId;
    const { start_date, end_date } = req.query;

    let dateFilter = '';
    const params: any[] = [businessId];
    let paramCount = 1;

    if (start_date) {
      paramCount++;
      dateFilter += ` AND transaction_date >= $${paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      dateFilter += ` AND transaction_date <= $${paramCount}`;
      params.push(end_date);
    }

    // Total revenue and transactions
    const revenueResult = await pool.query(
      `SELECT 
         COUNT(*) as total_transactions,
         COALESCE(SUM(service_price), 0) as total_revenue,
         COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN service_price ELSE 0 END), 0) as cash_revenue,
         COALESCE(SUM(CASE WHEN payment_method = 'mpesa' THEN service_price ELSE 0 END), 0) as mpesa_revenue,
         COALESCE(SUM(CASE WHEN payment_method = 'card' THEN service_price ELSE 0 END), 0) as card_revenue
       FROM salon_transactions
       WHERE business_id = $1${dateFilter}`,
      params
    );

    // Top services
    const servicesResult = await pool.query(
      `SELECT 
         srv.name,
         COUNT(t.id) as service_count,
         COALESCE(SUM(t.service_price), 0) as total_revenue
       FROM salon_transactions t
       JOIN salon_services srv ON t.service_id = srv.id
       WHERE t.business_id = $1${dateFilter}
       GROUP BY srv.id, srv.name
       ORDER BY service_count DESC
       LIMIT 5`,
      params
    );

    // Active employees
    const employeesResult = await pool.query(
      `SELECT COUNT(*) as active_employees
       FROM salon_users
       WHERE business_id = $1 AND role = 'employee' AND is_active = TRUE`,
      [businessId]
    );

    // Low stock products
    const lowStockResult = await pool.query(
      `SELECT COUNT(*) as low_stock_count
       FROM salon_products
       WHERE business_id = $1 AND is_active = TRUE AND current_stock <= min_stock_level`,
      [businessId]
    );

    res.json({
      success: true,
      data: {
        revenue: revenueResult.rows[0],
        top_services: servicesResult.rows,
        active_employees: employeesResult.rows[0].active_employees,
        low_stock_count: lowStockResult.rows[0].low_stock_count
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats' });
  }
};
