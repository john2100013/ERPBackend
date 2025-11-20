import { Response } from 'express';
import pool from '../database/connection';
import { AuthenticatedRequest } from '../middleware/auth';

// Start a shift (clock in)
export const startShift = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.user?.id;
    const userId = req.user?.id;
    const { starting_float } = req.body;

    // Check if user has an open shift
    const existingShift = await pool.query(
      `SELECT * FROM salon_shifts 
       WHERE user_id = $1 AND status = 'open'`,
      [userId]
    );

    if (existingShift.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'You already have an open shift. Please close it first.' 
      });
    }

    const result = await pool.query(
      `INSERT INTO salon_shifts (business_id, user_id, starting_float)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [businessId, userId, starting_float || 0]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error starting shift:', error);
    res.status(500).json({ success: false, message: 'Failed to start shift' });
  }
};

// Get current open shift
export const getCurrentShift = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    const result = await pool.query(
      `SELECT s.*, u.name as user_name
       FROM salon_shifts s
       JOIN users u ON s.user_id = u.id
       WHERE s.user_id = $1 AND s.status = 'open'
       ORDER BY s.clock_in DESC
       LIMIT 1`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows[0] || null
    });
  } catch (error) {
    console.error('Error fetching current shift:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch current shift' });
  }
};

// Close shift (clock out)
export const closeShift = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { actual_cash, notes } = req.body;

    // Get shift with transactions summary
    const shiftResult = await pool.query(
      `SELECT * FROM salon_shifts 
       WHERE id = $1 AND user_id = $2 AND status = 'open'`,
      [id, userId]
    );

    if (shiftResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Open shift not found' });
    }

    const shift = shiftResult.rows[0];

    // Calculate totals from transactions
    const transactionsResult = await pool.query(
      `SELECT 
         COALESCE(SUM(amount_paid), 0) as total_sales,
         COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount_paid ELSE 0 END), 0) as cash_sales,
         COALESCE(SUM(CASE WHEN payment_method = 'mpesa' THEN amount_paid ELSE 0 END), 0) as mpesa_sales,
         COALESCE(SUM(CASE WHEN payment_method = 'card' THEN amount_paid ELSE 0 END), 0) as card_sales
       FROM salon_transactions
       WHERE shift_id = $1`,
      [id]
    );

    const totals = transactionsResult.rows[0];
    const expected_cash = parseFloat(shift.starting_float) + parseFloat(totals.cash_sales);
    const difference = parseFloat(actual_cash) - expected_cash;

    // Update shift
    const result = await pool.query(
      `UPDATE salon_shifts 
       SET clock_out = CURRENT_TIMESTAMP,
           status = 'closed',
           total_sales = $1,
           cash_sales = $2,
           mpesa_sales = $3,
           card_sales = $4,
           expected_cash = $5,
           actual_cash = $6,
           difference = $7,
           notes = $8
       WHERE id = $9
       RETURNING *`,
      [
        totals.total_sales,
        totals.cash_sales,
        totals.mpesa_sales,
        totals.card_sales,
        expected_cash,
        actual_cash,
        difference,
        notes,
        id
      ]
    );

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error closing shift:', error);
    res.status(500).json({ success: false, message: 'Failed to close shift' });
  }
};

// Get shift history
export const getShifts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.user?.id;
    const { user_id, start_date, end_date, status } = req.query;

    let query = `
      SELECT s.*, u.name as user_name, u.email
      FROM salon_shifts s
      JOIN users u ON s.user_id = u.id
      WHERE s.business_id = $1
    `;
    const params: any[] = [businessId];
    let paramCount = 1;

    if (user_id) {
      paramCount++;
      query += ` AND s.user_id = $${paramCount}`;
      params.push(user_id);
    }

    if (start_date) {
      paramCount++;
      query += ` AND s.clock_in >= $${paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      query += ` AND s.clock_in <= $${paramCount}`;
      params.push(end_date);
    }

    if (status) {
      paramCount++;
      query += ` AND s.status = $${paramCount}`;
      params.push(status);
    }

    query += ' ORDER BY s.clock_in DESC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching shifts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch shifts' });
  }
};

// Get shift details with transactions
export const getShiftDetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user?.id;

    const shiftResult = await pool.query(
      `SELECT s.*, u.name as user_name, u.email
       FROM salon_shifts s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = $1 AND s.business_id = $2`,
      [id, businessId]
    );

    if (shiftResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Shift not found' });
    }

    const transactionsResult = await pool.query(
      `SELECT t.*, 
              e.name as employee_name,
              srv.name as service_name
       FROM salon_transactions t
       JOIN users e ON t.employee_id = e.id
       JOIN salon_services srv ON t.service_id = srv.id
       WHERE t.shift_id = $1
       ORDER BY t.transaction_date DESC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        shift: shiftResult.rows[0],
        transactions: transactionsResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching shift details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch shift details' });
  }
};
