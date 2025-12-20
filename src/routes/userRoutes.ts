import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import pool from '../database/connection';
import bcrypt from 'bcryptjs';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Get all users for the business (Admin only)
router.get('/', async (req: AuthenticatedRequest, res) => {
  const client = await pool.connect();
  
  try {
    const businessId = req.businessId;
    const userRole = req.role;

    // Only Admin can view users
    if (userRole !== 'admin' && userRole !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const result = await client.query(
      `SELECT id, business_id, email, first_name, last_name, role, status, created_at, updated_at
       FROM users
       WHERE business_id = $1
       ORDER BY created_at DESC`,
      [businessId]
    );

    const users = result.rows.map(user => ({
      ...user,
      is_active: user.status === 'active'
    }));

    res.json({
      success: true,
      data: { users }
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  } finally {
    client.release();
  }
});

// Create new user (Admin only)
router.post('/', async (req: AuthenticatedRequest, res) => {
  const client = await pool.connect();
  
  try {
    const businessId = req.businessId;
    const userRole = req.role;
    const { email, password, first_name, last_name, role } = req.body;

    // Only Admin can create users
    if (userRole !== 'admin' && userRole !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Validate required fields
    if (!email || !password || !first_name || !last_name || !role) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Validate role
    if (role !== 'Admin' && role !== 'User') {
      return res.status(400).json({
        success: false,
        message: 'Role must be either "Admin" or "User"'
      });
    }

    // Check if email already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Convert role to database format (Admin -> admin, User -> user)
    const dbRole = role === 'Admin' ? 'admin' : 'user';

    // Create user
    const result = await client.query(
      `INSERT INTO users (business_id, email, first_name, last_name, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       RETURNING id, business_id, email, first_name, last_name, role, status, created_at, updated_at`,
      [businessId, email.toLowerCase().trim(), first_name.trim(), last_name.trim(), hashedPassword, dbRole]
    );

    const user = result.rows[0];
    const userResponse = {
      ...user,
      role: user.role === 'admin' ? 'Admin' : user.role === 'user' ? 'User' : user.role,
      is_active: user.status === 'active'
    };

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { user: userResponse }
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user'
    });
  } finally {
    client.release();
  }
});

// Update user (Admin only)
router.put('/:id', async (req: AuthenticatedRequest, res) => {
  const client = await pool.connect();
  
  try {
    const businessId = req.businessId;
    const userRole = req.role;
    const userId = parseInt(req.params.id);
    const { email, first_name, last_name, role, status, password } = req.body;

    // Only Admin can update users
    if (userRole !== 'admin' && userRole !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Check if user exists and belongs to the business
    const existingUser = await client.query(
      'SELECT id FROM users WHERE id = $1 AND business_id = $2',
      [userId, businessId]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (email) {
      // Check if email already exists for another user
      const emailCheck = await client.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email.toLowerCase().trim(), userId]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }
      updates.push(`email = $${paramCount++}`);
      values.push(email.toLowerCase().trim());
    }

    if (first_name) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(first_name.trim());
    }

    if (last_name) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(last_name.trim());
    }

    if (role) {
      if (role !== 'Admin' && role !== 'User') {
        return res.status(400).json({
          success: false,
          message: 'Role must be either "Admin" or "User"'
        });
      }
      const dbRole = role === 'Admin' ? 'admin' : 'user';
      updates.push(`role = $${paramCount++}`);
      values.push(dbRole);
    }

    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 12);
      updates.push(`password_hash = $${paramCount++}`);
      values.push(hashedPassword);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId, businessId);

    const result = await client.query(
      `UPDATE users 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount} AND business_id = $${paramCount + 1}
       RETURNING id, business_id, email, first_name, last_name, role, status, created_at, updated_at`,
      values
    );

    const user = result.rows[0];
    const userResponse = {
      ...user,
      role: user.role === 'admin' ? 'Admin' : user.role === 'user' ? 'User' : user.role,
      is_active: user.status === 'active'
    };

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user: userResponse }
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user'
    });
  } finally {
    client.release();
  }
});

// Delete user (Admin only)
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  const client = await pool.connect();
  
  try {
    const businessId = req.businessId;
    const userRole = req.role;
    const userId = parseInt(req.params.id);

    // Only Admin can delete users
    if (userRole !== 'admin' && userRole !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Cannot delete yourself
    if (userId === req.userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Check if user exists and belongs to the business
    const existingUser = await client.query(
      'SELECT id FROM users WHERE id = $1 AND business_id = $2',
      [userId, businessId]
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await client.query(
      'DELETE FROM users WHERE id = $1 AND business_id = $2',
      [userId, businessId]
    );

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  } finally {
    client.release();
  }
});

// Get employee activity analytics (Admin only)
router.get('/analytics/activity', async (req: AuthenticatedRequest, res) => {
  const client = await pool.connect();
  
  try {
    const businessId = req.businessId;
    const userRole = req.role;

    // Only Admin can view analytics
    if (userRole !== 'admin' && userRole !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Get date range from query params
    const { dateRange = 'this_month' } = req.query;
    
    let dateFilter = '';
    const dateParams: any[] = [];
    
    const now = new Date();
    let startDate: Date;
    
    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'this_week':
        const dayOfWeek = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'this_quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        dateFilter = `AND created_at >= $${dateParams.length + 1} AND created_at <= $${dateParams.length + 2}`;
        dateParams.push(startDate, lastMonthEnd);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    if (!dateFilter) {
      dateFilter = `AND created_at >= $${dateParams.length + 1}`;
      dateParams.push(startDate);
    }

    // Get user activity from invoices
    const invoiceActivity = await client.query(
      `SELECT 
        created_by as user_id,
        COUNT(*) as invoice_count,
        COALESCE(SUM(total_amount), 0) as total_amount
       FROM invoices
       WHERE business_id = $1 AND created_by IS NOT NULL ${dateFilter}
       GROUP BY created_by`,
      [businessId, ...dateParams]
    );

    // Get user activity from quotations
    const quotationActivity = await client.query(
      `SELECT 
        created_by as user_id,
        COUNT(*) as quotation_count,
        COALESCE(SUM(total_amount), 0) as total_amount
       FROM quotations
       WHERE business_id = $1 AND created_by IS NOT NULL ${dateFilter}
       GROUP BY created_by`,
      [businessId, ...dateParams]
    );

    // Combine results
    const activityMap = new Map();
    
    invoiceActivity.rows.forEach((row: any) => {
      const userId = row.user_id;
      if (!activityMap.has(userId)) {
        activityMap.set(userId, {
          user_id: userId,
          invoice_count: 0,
          quotation_count: 0,
          total_amount: 0
        });
      }
      const activity = activityMap.get(userId);
      activity.invoice_count = parseInt(row.invoice_count);
      activity.total_amount += parseFloat(row.total_amount || 0);
    });

    quotationActivity.rows.forEach((row: any) => {
      const userId = row.user_id;
      if (!activityMap.has(userId)) {
        activityMap.set(userId, {
          user_id: userId,
          invoice_count: 0,
          quotation_count: 0,
          total_amount: 0
        });
      }
      const activity = activityMap.get(userId);
      activity.quotation_count = parseInt(row.quotation_count);
      activity.total_amount += parseFloat(row.total_amount || 0);
    });

    // Get user details
    const userIds = Array.from(activityMap.keys());
    if (userIds.length > 0) {
      const usersResult = await client.query(
        `SELECT id, first_name, last_name, email, role
         FROM users
         WHERE id = ANY($1) AND business_id = $2`,
        [userIds, businessId]
      );

      usersResult.rows.forEach((user: any) => {
        const activity = activityMap.get(user.id);
        if (activity) {
          activity.user = {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            role: user.role === 'admin' ? 'Admin' : user.role === 'user' ? 'User' : user.role
          };
        }
      });
    }

    const activities = Array.from(activityMap.values());

    res.json({
      success: true,
      data: { activities }
    });
  } catch (error: any) {
    console.error('Error fetching employee activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee activity'
    });
  } finally {
    client.release();
  }
});

export default router;

