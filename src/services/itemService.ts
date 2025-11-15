import { pool } from '../database/connection';
import type { Item } from '../types';

export class ItemService {
  static async createItem(businessId: number, itemData: {
    item_name: string;
    quantity: number;
    buying_price: number;
    selling_price: number;
    rate?: number;
    unit?: string;
    description?: string;
  }): Promise<Item> {
    const { item_name, quantity, buying_price, selling_price, rate, unit, description } = itemData;
    
    // Use selling_price as rate if rate not provided
    const itemRate = rate || selling_price;
    
    // Calculate amount using selling price
    const amount = quantity * selling_price;

    const result = await pool.query(
      `INSERT INTO items (business_id, item_name, quantity, buying_price, selling_price, rate, unit, description, amount, code, unit_price, stock_quantity, uom, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $6, $3, $7, true)
       RETURNING *`,
      [
        businessId, 
        item_name, 
        quantity, 
        buying_price,
        selling_price,
        itemRate, 
        unit || 'PCS', 
        description || '', 
        amount,
        `ITEM${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}` // Generate simple item code
      ]
    );

    return result.rows[0];
  }

  static async getItems(businessId: number, options: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  } = {}): Promise<{ items: Item[]; total: number; page: number; totalPages: number }> {
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
      whereClause += ` AND (item_name ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    // Validate sort column
    const allowedSortColumns = ['item_name', 'quantity', 'rate', 'amount', 'created_at', 'updated_at'];
    const validSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const validSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM items ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count);

    // Get items
    const itemsResult = await pool.query(
      `SELECT * FROM items ${whereClause}
       ORDER BY ${validSortBy} ${validSortOrder}
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, limit, offset]
    );

    const totalPages = Math.ceil(total / limit);

    return {
      items: itemsResult.rows,
      total,
      page,
      totalPages
    };
  }

  static async getItemById(businessId: number, itemId: number): Promise<Item | null> {
    const result = await pool.query(
      'SELECT * FROM items WHERE id = $1 AND business_id = $2',
      [itemId, businessId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  static async updateItem(businessId: number, itemId: number, updateData: {
    item_name?: string;
    quantity?: number;
    buying_price?: number;
    selling_price?: number;
    rate?: number;
    unit?: string;
    description?: string;
  }): Promise<Item | null> {
    const existingItem = await this.getItemById(businessId, itemId);
    if (!existingItem) {
      return null;
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
      return existingItem;
    }

    // If quantity, selling_price, or rate is being updated, recalculate amount and sync with old columns
    if (updateData.quantity !== undefined || updateData.selling_price !== undefined || updateData.rate !== undefined) {
      const newQuantity = updateData.quantity !== undefined ? updateData.quantity : (existingItem.quantity || existingItem.stock_quantity);
      const newSellingPrice = updateData.selling_price !== undefined ? updateData.selling_price : existingItem.selling_price;
      const newRate = updateData.rate !== undefined ? updateData.rate : newSellingPrice; // Use selling_price as rate if not provided
      
      // Update amount using selling price
      paramCount++;
      updates.push(`amount = $${paramCount}`);
      values.push(newQuantity * newSellingPrice);
      
      // Sync rate with selling price if rate not explicitly provided
      if (updateData.selling_price !== undefined && updateData.rate === undefined) {
        paramCount++;
        updates.push(`rate = $${paramCount}`);
        values.push(newSellingPrice);
      }
      
      // Sync with old columns
      if (updateData.quantity !== undefined) {
        paramCount++;
        updates.push(`stock_quantity = $${paramCount}`);
        values.push(updateData.quantity);
      }
      
      if (updateData.rate !== undefined || updateData.selling_price !== undefined) {
        paramCount++;
        updates.push(`unit_price = $${paramCount}`);
        values.push(newRate);
      }
      
      if (updateData.unit !== undefined) {
        paramCount++;
        updates.push(`uom = $${paramCount}`);
        values.push(updateData.unit);
      }
    }

    // Add updated_at
    paramCount++;
    updates.push(`updated_at = $${paramCount}`);
    values.push(new Date());

    // Add WHERE clause parameters
    paramCount++;
    values.push(itemId);
    paramCount++;
    values.push(businessId);

    const result = await pool.query(
      `UPDATE items SET ${updates.join(', ')} 
       WHERE id = $${paramCount - 1} AND business_id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  static async deleteItem(businessId: number, itemId: number): Promise<boolean> {
    // Check if item exists and belongs to business
    const existingItem = await this.getItemById(businessId, itemId);
    if (!existingItem) {
      return false;
    }

    // Check if item is used in any invoices
    const invoiceUsage = await pool.query(
      `SELECT COUNT(*) FROM invoice_lines il
       JOIN invoices i ON il.invoice_id = i.id
       WHERE il.item_id = $1 AND i.business_id = $2`,
      [itemId, businessId]
    );

    if (parseInt(invoiceUsage.rows[0].count) > 0) {
      throw new Error('Cannot delete item that is used in invoices');
    }

    const result = await pool.query(
      'DELETE FROM items WHERE id = $1 AND business_id = $2',
      [itemId, businessId]
    );

    return (result.rowCount || 0) > 0;
  }

  static async getItemStats(businessId: number): Promise<{
    totalItems: number;
    totalValue: number;
    lowStockItems: number;
  }> {
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total_items,
         COALESCE(SUM(amount), 0) as total_value,
         COUNT(CASE WHEN quantity < 10 THEN 1 END) as low_stock_items
       FROM items 
       WHERE business_id = $1`,
      [businessId]
    );

    const stats = result.rows[0];
    return {
      totalItems: parseInt(stats.total_items),
      totalValue: parseFloat(stats.total_value),
      lowStockItems: parseInt(stats.low_stock_items)
    };
  }
}