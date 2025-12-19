import { pool } from '../database/connection';

export interface FinancialAccount {
  id: number;
  business_id: number;
  account_name: string;
  account_type: 'cash' | 'bank' | 'mobile_money';
  account_number?: string;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class FinancialAccountService {
  static async createAccount(businessId: number, accountData: {
    account_name: string;
    account_type: 'cash' | 'bank' | 'mobile_money';
    account_number?: string;
    balance: number;
  }): Promise<FinancialAccount> {
    const { account_name, account_type, account_number, balance } = accountData;

    const result = await pool.query(
      `INSERT INTO financial_accounts (business_id, account_name, account_type, account_number, opening_balance, current_balance, is_active)
       VALUES ($1, $2, $3, $4, $5, $5, true)
       RETURNING *`,
      [businessId, account_name, account_type, account_number, balance]
    );

    return result.rows[0];
  }

  static async getAccounts(businessId: number, options: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  } = {}): Promise<{ accounts: FinancialAccount[]; total: number; page: number; totalPages: number }> {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE business_id = $1';
    const queryParams: any[] = [businessId];
    let paramCount = 1;

    // Add search filter
    if (search) {
      paramCount++;
      whereClause += ` AND (account_name ILIKE $${paramCount} OR account_number ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    // Validate sort column
    const allowedSortColumns = ['account_name', 'account_type', 'balance', 'created_at', 'updated_at'];
    const validSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const validSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM financial_accounts ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count);

    // Get accounts
    const accountsResult = await pool.query(
      `SELECT * FROM financial_accounts ${whereClause}
       ORDER BY ${validSortBy} ${validSortOrder}
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, limit, offset]
    );

    const totalPages = Math.ceil(total / limit);

    return {
      accounts: accountsResult.rows,
      total,
      page,
      totalPages
    };
  }

  static async getAccountById(businessId: number, accountId: number): Promise<FinancialAccount | null> {
    const result = await pool.query(
      'SELECT * FROM financial_accounts WHERE id = $1 AND business_id = $2',
      [accountId, businessId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  static async updateAccount(businessId: number, accountId: number, updateData: {
    account_name?: string;
    account_type?: 'cash' | 'bank' | 'mobile_money';
    account_number?: string;
    balance?: number;
    is_active?: boolean;
  }): Promise<FinancialAccount | null> {
    const existingAccount = await this.getAccountById(businessId, accountId);
    if (!existingAccount) {
      return null;
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    // Build dynamic update query
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        paramCount++;
        // Map balance to current_balance for database compatibility
        const dbColumn = key === 'balance' ? 'current_balance' : key;
        updates.push(`${dbColumn} = $${paramCount}`);
        values.push(value);
      }
    });

    if (updates.length === 0) {
      return existingAccount;
    }

    // Add updated_at
    paramCount++;
    updates.push(`updated_at = $${paramCount}`);
    values.push(new Date());

    // Add WHERE clause parameters
    paramCount++;
    values.push(accountId);
    paramCount++;
    values.push(businessId);

    const result = await pool.query(
      `UPDATE financial_accounts SET ${updates.join(', ')} 
       WHERE id = $${paramCount - 1} AND business_id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  static async deleteAccount(businessId: number, accountId: number): Promise<boolean> {
    // Check if account exists and belongs to business
    const existingAccount = await this.getAccountById(businessId, accountId);
    if (!existingAccount) {
      return false;
    }

    // Check if account is used in any payments
    const paymentUsage = await pool.query(
      `SELECT COUNT(*) FROM invoice_payments 
       WHERE payment_account_id = $1`,
      [accountId]
    );

    if (parseInt(paymentUsage.rows[0].count) > 0) {
      throw new Error('Cannot delete account that has payment transactions');
    }

    const result = await pool.query(
      'DELETE FROM financial_accounts WHERE id = $1 AND business_id = $2',
      [accountId, businessId]
    );

    return (result.rowCount || 0) > 0;
  }

  static async updateAccountBalance(accountId: number, amount: number, operation: 'add' | 'subtract'): Promise<FinancialAccount | null> {
    const operator = operation === 'add' ? '+' : '-';
    
    const result = await pool.query(
      `UPDATE financial_accounts 
       SET current_balance = current_balance ${operator} $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [Math.abs(amount), accountId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  static async getAccountStats(businessId: number): Promise<{
    totalAccounts: number;
    totalBalance: number;
    accountsByType: { account_type: string; count: number; total_balance: number }[];
  }> {
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total_accounts,
         COALESCE(SUM(current_balance), 0) as total_balance
       FROM financial_accounts 
       WHERE business_id = $1 AND is_active = true`,
      [businessId]
    );

    const typeStats = await pool.query(
      `SELECT 
         account_type,
         COUNT(*) as count,
         COALESCE(SUM(current_balance), 0) as total_balance
       FROM financial_accounts 
       WHERE business_id = $1 AND is_active = true
       GROUP BY account_type
       ORDER BY account_type`,
      [businessId]
    );

    const stats = result.rows[0];
    return {
      totalAccounts: parseInt(stats.total_accounts),
      totalBalance: parseFloat(stats.total_balance),
      accountsByType: typeStats.rows.map(row => ({
        account_type: row.account_type,
        count: parseInt(row.count),
        total_balance: parseFloat(row.total_balance)
      }))
    };
  }

  static async getAccountTransactionHistory(businessId: number, accountId: number | null, filter: 'today' | 'week' | 'month' | 'custom', startDate?: string, endDate?: string): Promise<{
    date: string;
    account_id: number;
    account_name: string;
    balance: number;
    transactions: number;
    total_inflow: number;
    total_outflow: number;
  }[]> {
    let dateFilter = '';
    const queryParams: any[] = [businessId];
    let paramCount = 1;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    switch (filter) {
      case 'today':
        // From midnight today
        dateFilter = `AND DATE(ip.payment_date) = $${++paramCount}`;
        queryParams.push(todayStr);
        break;
      case 'week':
        // From beginning of week (Monday)
        const weekStart = new Date(today);
        const dayOfWeek = weekStart.getDay();
        const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
        weekStart.setDate(diff);
        weekStart.setHours(0, 0, 0, 0);
        const weekStartStr = weekStart.toISOString().split('T')[0];
        dateFilter = `AND DATE(ip.payment_date) >= $${++paramCount}`;
        queryParams.push(weekStartStr);
        break;
      case 'month':
        // From beginning of month
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthStartStr = monthStart.toISOString().split('T')[0];
        dateFilter = `AND DATE(ip.payment_date) >= $${++paramCount}`;
        queryParams.push(monthStartStr);
        break;
      case 'custom':
        // Custom date range
        if (startDate) {
          dateFilter += ` AND DATE(ip.payment_date) >= $${++paramCount}`;
          queryParams.push(startDate);
        }
        if (endDate) {
          dateFilter += ` AND DATE(ip.payment_date) <= $${++paramCount}`;
          queryParams.push(endDate);
        }
        break;
    }

    let accountFilter = '';
    if (accountId) {
      accountFilter = `AND ip.financial_account_id = $${++paramCount}`;
      queryParams.push(accountId);
    }

    // Get transaction history grouped by date and account
    // Show daily transaction totals (inflow/outflow) for graph visualization
    const query = `
      SELECT 
        DATE(ip.payment_date) as date,
        fa.id as account_id,
        fa.account_name,
        COUNT(DISTINCT ip.id) as transactions,
        COALESCE(SUM(ip.amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN ip.amount > 0 THEN ip.amount ELSE 0 END), 0) as total_inflow,
        COALESCE(SUM(CASE WHEN ip.amount < 0 THEN ABS(ip.amount) ELSE 0 END), 0) as total_outflow,
        fa.current_balance as balance
      FROM invoice_payments ip
      INNER JOIN financial_accounts fa ON ip.financial_account_id = fa.id
      WHERE ip.business_id = $1 ${accountFilter} ${dateFilter}
      GROUP BY DATE(ip.payment_date), fa.id, fa.account_name, fa.current_balance
      ORDER BY date ASC, fa.account_name`;

    const result = await pool.query(query, queryParams);

    return result.rows.map(row => ({
      date: row.date,
      account_id: row.account_id,
      account_name: row.account_name,
      balance: parseFloat(row.balance),
      transactions: parseInt(row.transactions),
      total_inflow: parseFloat(row.total_inflow),
      total_outflow: parseFloat(row.total_outflow),
      total_amount: parseFloat(row.total_amount || 0)
    }));
  }
}