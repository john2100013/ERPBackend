import { pool } from '../database/connection';
import { FinancialAccountService } from './financialAccountService';

export interface GoodsReturn {
  id: number;
  business_id: number;
  return_number: string;
  invoice_id?: number;
  customer_name: string;
  return_date: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  refund_amount: number;
  refund_method?: string;
  financial_account_id?: number;
  status: 'pending' | 'processed' | 'cancelled';
  reason?: string;
  notes?: string;
  created_by: number;
  created_at: Date;
  updated_at: Date;
  lines?: GoodsReturnLine[];
}

export interface GoodsReturnLine {
  id: number;
  return_id: number;
  item_id: number;
  quantity: number;
  unit_price: number;
  total: number;
  description: string;
  code: string;
  uom?: string;
  created_at: Date;
  updated_at: Date;
}

export class GoodsReturnService {
  static async createReturn(businessId: number, userId: number, returnData: {
    customer_name: string;
    invoice_id?: number;
    return_date: string;
    reason?: string;
    notes?: string;
    refund_method?: string;
    financial_account_id?: number;
    refund_amount: number;
    lines: Array<{
      item_id: number;
      quantity: number;
      unit_price: number;
      description: string;
      code: string;
      uom?: string;
    }>;
  }): Promise<GoodsReturn> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const { 
        customer_name, 
        invoice_id, 
        return_date, 
        reason, 
        notes, 
        refund_method, 
        financial_account_id, 
        refund_amount, 
        lines 
      } = returnData;

      // Calculate totals
      const subtotal = lines.reduce((sum, line) => sum + (line.quantity * line.unit_price), 0);
      const vat_amount = subtotal * 0.16;
      const total_amount = subtotal + vat_amount;

      // Generate return number
      const returnNumberResult = await client.query(
        "SELECT generate_return_number($1) as return_number",
        [businessId.toString()]
      );
      const return_number = returnNumberResult.rows[0].return_number;

      // Create goods return
      const returnResult = await client.query(
        `INSERT INTO goods_returns (
          business_id, return_number, invoice_id, customer_name, return_date,
          subtotal, vat_amount, total_amount, refund_amount, refund_method,
          financial_account_id, status, reason, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12, $13, $14)
         RETURNING *`,
        [
          businessId, return_number, invoice_id, customer_name, return_date,
          subtotal, vat_amount, total_amount, refund_amount, refund_method,
          financial_account_id, reason, notes, userId
        ]
      );

      const goodsReturn = returnResult.rows[0];

      // Create return lines
      const returnLines = [];
      for (const line of lines) {
        const lineResult = await client.query(
          `INSERT INTO goods_return_lines (
            return_id, item_id, quantity, unit_price, total, description, code, uom
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            goodsReturn.id, line.item_id, line.quantity, line.unit_price,
            line.quantity * line.unit_price, line.description, line.code, line.uom
          ]
        );
        returnLines.push(lineResult.rows[0]);
      }

      await client.query('COMMIT');

      return { ...goodsReturn, lines: returnLines };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getReturns(businessId: number, options: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  } = {}): Promise<{ returns: GoodsReturn[]; total: number; page: number; totalPages: number }> {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE gr.business_id = $1';
    const queryParams: any[] = [businessId];
    let paramCount = 1;

    // Add search filter
    if (search) {
      paramCount++;
      whereClause += ` AND (gr.customer_name ILIKE $${paramCount} OR gr.return_number ILIKE $${paramCount} OR gr.reason ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    // Add status filter
    if (status) {
      paramCount++;
      whereClause += ` AND gr.status = $${paramCount}`;
      queryParams.push(status);
    }

    // Validate sort column
    const allowedSortColumns = ['return_number', 'customer_name', 'return_date', 'total_amount', 'status', 'created_at'];
    const validSortBy = allowedSortColumns.includes(sortBy) ? `gr.${sortBy}` : 'gr.created_at';
    const validSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM goods_returns gr ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count);

    // Get returns with lines
    const returnsResult = await pool.query(
      `SELECT gr.*, 
        json_agg(
          json_build_object(
            'id', grl.id,
            'item_id', grl.item_id,
            'quantity', grl.quantity,
            'unit_price', grl.unit_price,
            'total', grl.total,
            'description', grl.description,
            'code', grl.code,
            'uom', grl.uom
          ) ORDER BY grl.id
        ) as lines
       FROM goods_returns gr
       LEFT JOIN goods_return_lines grl ON gr.id = grl.return_id
       ${whereClause}
       GROUP BY gr.id
       ORDER BY ${validSortBy} ${validSortOrder}
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, limit, offset]
    );

    const totalPages = Math.ceil(total / limit);

    return {
      returns: returnsResult.rows.map(row => ({
        ...row,
        lines: row.lines[0].id ? row.lines : [] // Handle empty left join
      })),
      total,
      page,
      totalPages
    };
  }

  static async getReturnById(businessId: number, returnId: number): Promise<GoodsReturn | null> {
    const result = await pool.query(
      `SELECT gr.*, 
        json_agg(
          json_build_object(
            'id', grl.id,
            'item_id', grl.item_id,
            'quantity', grl.quantity,
            'unit_price', grl.unit_price,
            'total', grl.total,
            'description', grl.description,
            'code', grl.code,
            'uom', grl.uom
          ) ORDER BY grl.id
        ) as lines
       FROM goods_returns gr
       LEFT JOIN goods_return_lines grl ON gr.id = grl.return_id
       WHERE gr.id = $1 AND gr.business_id = $2
       GROUP BY gr.id`,
      [returnId, businessId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...row,
      lines: row.lines[0].id ? row.lines : []
    };
  }

  static async updateReturn(businessId: number, returnId: number, updateData: {
    customer_name?: string;
    return_date?: string;
    reason?: string;
    notes?: string;
    refund_method?: string;
    financial_account_id?: number;
    status?: string;
  }): Promise<GoodsReturn | null> {
    const existingReturn = await this.getReturnById(businessId, returnId);
    if (!existingReturn) {
      return null;
    }

    // Don't allow updates to processed returns
    if (existingReturn.status === 'processed') {
      throw new Error('Cannot update processed returns');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    // Build dynamic update query
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        paramCount++;
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
      }
    });

    if (updates.length === 0) {
      return existingReturn;
    }

    // Add updated_at
    paramCount++;
    updates.push(`updated_at = $${paramCount}`);
    values.push(new Date());

    // Add WHERE clause parameters
    paramCount++;
    values.push(returnId);
    paramCount++;
    values.push(businessId);

    const result = await pool.query(
      `UPDATE goods_returns SET ${updates.join(', ')} 
       WHERE id = $${paramCount - 1} AND business_id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  static async processReturn(businessId: number, returnId: number): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get the return with lines
      const goodsReturn = await this.getReturnById(businessId, returnId);
      if (!goodsReturn) {
        return { success: false, message: 'Goods return not found' };
      }

      if (goodsReturn.status !== 'pending') {
        return { success: false, message: 'Return has already been processed or cancelled' };
      }

      // Update item stock quantities (add back returned items)
      for (const line of goodsReturn.lines || []) {
        await client.query(
          `UPDATE items 
           SET quantity = quantity + $1, 
               stock_quantity = stock_quantity + $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 AND business_id = $3`,
          [line.quantity, line.item_id, businessId]
        );
      }

      // Update financial account if refund method specified
      if (goodsReturn.financial_account_id && goodsReturn.refund_amount > 0) {
        // Decrease the financial account balance (money going out for refund)
        await client.query(
          `UPDATE financial_accounts 
           SET current_balance = current_balance - $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 AND business_id = $3`,
          [goodsReturn.refund_amount, goodsReturn.financial_account_id, businessId]
        );
      }

      // Update return status to processed
      await client.query(
        `UPDATE goods_returns 
         SET status = 'processed', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND business_id = $2`,
        [returnId, businessId]
      );

      await client.query('COMMIT');

      return {
        success: true,
        message: 'Return processed successfully. Stock increased and financial account updated.',
        data: { returnId, stockUpdated: goodsReturn.lines?.length || 0 }
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async deleteReturn(businessId: number, returnId: number): Promise<boolean> {
    const existingReturn = await this.getReturnById(businessId, returnId);
    if (!existingReturn) {
      return false;
    }

    // Don't allow deletion of processed returns
    if (existingReturn.status === 'processed') {
      throw new Error('Cannot delete processed returns');
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Delete return lines first
      await client.query(
        'DELETE FROM goods_return_lines WHERE return_id = $1',
        [returnId]
      );

      // Delete the return
      const result = await client.query(
        'DELETE FROM goods_returns WHERE id = $1 AND business_id = $2',
        [returnId, businessId]
      );

      await client.query('COMMIT');

      return (result.rowCount || 0) > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getReturnStats(businessId: number): Promise<{
    totalReturns: number;
    totalRefundAmount: number;
    pendingReturns: number;
    processedReturns: number;
  }> {
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total_returns,
         COALESCE(SUM(refund_amount), 0) as total_refund_amount,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_returns,
         COUNT(CASE WHEN status = 'processed' THEN 1 END) as processed_returns
       FROM goods_returns 
       WHERE business_id = $1`,
      [businessId]
    );

    const stats = result.rows[0];
    return {
      totalReturns: parseInt(stats.total_returns),
      totalRefundAmount: parseFloat(stats.total_refund_amount),
      pendingReturns: parseInt(stats.pending_returns),
      processedReturns: parseInt(stats.processed_returns)
    };
  }
}