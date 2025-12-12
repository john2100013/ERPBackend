import { Response } from 'express';
import pool from '../database/connection';
import { AuthenticatedRequest } from '../middleware/auth';

// Start a shift (clock in)
export const startShift = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessId;
    const userId = req.user?.id;
    const { starting_float } = req.body;

    console.log('🔍 Starting shift for user_id:', userId, 'business_id:', businessId);

    // Check if user has an open shift
    const existingShift = await pool.query(
      `SELECT s.*, CONCAT(u.first_name, ' ', u.last_name) as user_name
       FROM salon_shifts s
       JOIN users u ON s.user_id = u.id
       WHERE s.user_id = $1 AND s.status = 'open'`,
      [userId]
    );

    console.log('🔍 Existing open shifts found:', existingShift.rows.length);
    if (existingShift.rows.length > 0) {
      console.log('⚠️ Open shift details:', existingShift.rows[0]);
      return res.status(400).json({ 
        success: false, 
        message: 'You already have an open shift. Please close it first.',
        existing_shift: existingShift.rows[0]
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
    const businessId = req.businessId;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    console.log('🔍 Getting current shift for user_id:', userId, 'role:', userRole, 'business_id:', businessId);

    // For owners/admins, show any open shift in the business
    // For employees, show only their own open shift
    let query = `
      SELECT s.*, CONCAT(u.first_name, ' ', u.last_name) as user_name
      FROM salon_shifts s
      JOIN users u ON s.user_id = u.id
      WHERE s.business_id = $1 AND s.status = 'open'
    `;
    const params: any[] = [businessId];

    if (userRole !== 'owner' && userRole !== 'admin') {
      // Employee: only show their own shift
      query += ` AND s.user_id = $2`;
      params.push(userId);
    }

    query += ` ORDER BY s.clock_in DESC LIMIT 1`;

    const result = await pool.query(query, params);

    console.log('✅ Current shift query result:', result.rows.length, 'shifts found');
    if (result.rows.length > 0) {
      console.log('📋 Shift details:', result.rows[0]);
    }

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
    const userRole = req.user?.role;
    const businessId = req.businessId;
    const { actual_cash, notes } = req.body;

    console.log('🔍 Closing shift:', { id, userId, userRole, businessId, actual_cash });

    // Get shift with transactions summary
    // Owners/admins can close any shift in their business, employees can only close their own
    let query = `
      SELECT * FROM salon_shifts 
      WHERE id = $1 AND business_id = $2 AND status = 'open'
    `;
    const params: any[] = [id, businessId];

    if (userRole !== 'owner' && userRole !== 'admin') {
      // Employee: only allow closing their own shift
      query += ` AND user_id = $3`;
      params.push(userId);
    }

    const shiftResult = await pool.query(query, params);

    console.log('🔍 Shift query result:', shiftResult.rows.length, 'shifts found');

    if (shiftResult.rows.length === 0) {
      console.log('⚠️ No open shift found with id:', id);
      return res.status(404).json({ 
        success: false, 
        message: 'Open shift not found or you do not have permission to close it' 
      });
    }

    const shift = shiftResult.rows[0];

    // Calculate totals from transactions
    const transactionsResult = await pool.query(
      `SELECT 
         COALESCE(SUM(service_price), 0) as total_sales,
         COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN service_price ELSE 0 END), 0) as cash_sales,
         COALESCE(SUM(CASE WHEN payment_method = 'mpesa' THEN service_price ELSE 0 END), 0) as mpesa_sales,
         COALESCE(SUM(CASE WHEN payment_method = 'card' THEN service_price ELSE 0 END), 0) as card_sales
       FROM salon_transactions
       WHERE shift_id = $1`,
      [id]
    );

    const totals = transactionsResult.rows[0];
    
    // Convert to numbers if they're strings (PostgreSQL DECIMAL returns as string)
    const startingFloat = typeof shift.starting_float === 'string' 
      ? parseFloat(shift.starting_float) 
      : shift.starting_float || 0;
    const cashSales = typeof totals.cash_sales === 'string'
      ? parseFloat(totals.cash_sales)
      : totals.cash_sales || 0;
    const actualCashNum = typeof actual_cash === 'string'
      ? parseFloat(actual_cash)
      : actual_cash || 0;
    
    const expected_cash = startingFloat + cashSales;
    const difference = actualCashNum - expected_cash;
    
    console.log('💰 Cash calculations:', { startingFloat, cashSales, expected_cash, actualCashNum, difference });

    // Update shift
    const result = await pool.query(
      `UPDATE salon_shifts 
       SET clock_out = CURRENT_TIMESTAMP,
           status = 'closed',
           expected_cash = $1,
           ending_cash = $2,
           cash_difference = $3,
           notes = $4
       WHERE id = $5
       RETURNING *`,
      [
        expected_cash,
        actualCashNum,
        difference,
        notes || null,
        id
      ]
    );

    console.log('✅ Shift closed successfully:', result.rows[0]);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('❌ Error closing shift:', error);
    console.error('Error details:', error.message, error.stack);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to close shift' 
    });
  }
};

// Get shift history
export const getShifts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessId;
    const { user_id, start_date, end_date, status } = req.query;

    let query = `
      SELECT s.*, CONCAT(u.first_name, ' ', u.last_name) as user_name, u.email
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
    const businessId = req.businessId;

    const shiftResult = await pool.query(
      `SELECT s.*, CONCAT(u.first_name, ' ', u.last_name) as user_name, u.email
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
              CONCAT(e.first_name, ' ', e.last_name) as employee_name,
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
