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
    category_id?: number;
    category_1_id?: number;
    category_2_id?: number;
    reorder_level?: number;
    manufacturing_date?: string;
    expiry_date?: string;
  }): Promise<Item> {
    const { item_name, quantity, buying_price, selling_price, unit, description, category_id, category_1_id, category_2_id, reorder_level, manufacturing_date, expiry_date } = itemData;
    
    // Use selling_price as price (matching database schema)
    const itemPrice = selling_price;

    // Check if reorder_level column exists before inserting
    const columnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'items'
        AND column_name = 'reorder_level'
      );
    `);
    const hasReorderLevel = columnCheck.rows[0]?.exists || false;

    // Check if category_1_id and category_2_id columns exist
    const category1Check = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'items'
        AND column_name = 'category_1_id'
      );
    `);
    const hasCategory1 = category1Check.rows[0]?.exists || false;

    let insertedItem: any;
    
    if (hasReorderLevel && hasCategory1) {
      const result = await pool.query(
        `INSERT INTO items (business_id, name, quantity, buying_price, selling_price, price, description, category, category_id, category_1_id, category_2_id, reorder_level, manufacturing_date, expiry_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          businessId, 
          item_name, 
          quantity, 
          buying_price,
          selling_price,
          itemPrice,
          description || '',
          unit || 'PCS',
          category_id || null,
          category_1_id || null,
          category_2_id || null,
          reorder_level || 10,
          manufacturing_date || null,
          expiry_date || null
        ]
      );
      insertedItem = result.rows[0];
    } else if (hasCategory1) {
      const result = await pool.query(
        `INSERT INTO items (business_id, name, quantity, buying_price, selling_price, price, description, category, category_id, category_1_id, category_2_id, manufacturing_date, expiry_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          businessId, 
          item_name, 
          quantity, 
          buying_price,
          selling_price,
          itemPrice,
          description || '',
          unit || 'PCS',
          category_id || null,
          category_1_id || null,
          category_2_id || null,
          manufacturing_date || null,
          expiry_date || null
        ]
      );
      insertedItem = result.rows[0];
    } else if (hasReorderLevel) {
      const result = await pool.query(
        `INSERT INTO items (business_id, name, quantity, buying_price, selling_price, price, description, category, category_id, reorder_level, manufacturing_date, expiry_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          businessId, 
          item_name, 
          quantity, 
          buying_price,
          selling_price,
          itemPrice,
          description || '',
          unit || 'PCS',
          category_id || null,
          reorder_level || 10,
          manufacturing_date || null,
          expiry_date || null
        ]
      );
      insertedItem = result.rows[0];
    } else {
      const result = await pool.query(
        `INSERT INTO items (business_id, name, quantity, buying_price, selling_price, price, description, category, category_id, manufacturing_date, expiry_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          businessId, 
          item_name, 
          quantity, 
          buying_price,
          selling_price,
          itemPrice,
          description || '',
          unit || 'PCS',
          category_id || null,
          manufacturing_date || null,
          expiry_date || null
        ]
      );
      insertedItem = result.rows[0];
    }

    // Reload item with category names (similar to updateItem)
    const itemId = insertedItem.id;
    const categoryQuery = await pool.query(
      `SELECT 
        i.*,
        ic.name as category_name,
        ic1.name as category_1_name,
        ic2.name as category_2_name
      FROM items i
      LEFT JOIN item_categories ic ON i.category_id = ic.id AND ic.business_id = i.business_id
      LEFT JOIN item_categories ic1 ON i.category_1_id = ic1.id AND ic1.business_id = i.business_id
      LEFT JOIN item_categories ic2 ON i.category_2_id = ic2.id AND ic2.business_id = i.business_id
      WHERE i.id = $1 AND i.business_id = $2`,
      [itemId, businessId]
    );
    
    return this.transformItem(categoryQuery.rows[0] || insertedItem);
  }

  static transformItem(row: any): Item {
    // Transform database result to match Item interface
    return {
      id: row.id,
      business_id: row.business_id,
      code: `ITEM${String(row.id).padStart(3, '0')}`,
      description: row.description || '',
      unit_price: parseFloat(row.price || 0),
      uom: row.category || 'PCS',
      category: row.category,
      stock_quantity: row.quantity || 0,
      is_active: true,
      created_at: row.created_at,
      updated_at: row.updated_at,
      // Additional fields for frontend compatibility
      item_name: row.name,
      rate: parseFloat(row.price || 0),
      unit: row.category || 'PCS',
      quantity: row.quantity || 0,
      amount: (row.quantity || 0) * parseFloat(row.price || 0),
      buying_price: row.buying_price ? parseFloat(row.buying_price) : 0,
      selling_price: row.selling_price ? parseFloat(row.selling_price) : parseFloat(row.price || 0),
      // Multiple categories
      category_id: row.category_id || null,
      category_1_id: row.category_1_id || null,
      category_2_id: row.category_2_id || null
    };
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
    
    let whereClause = 'WHERE i.business_id = $1';
    const queryParams: any[] = [businessId];
    let paramCount = 1;

    // Add search filter
    if (search) {
      paramCount++;
      whereClause += ` AND (i.name ILIKE $${paramCount} OR i.description ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    // Validate sort column (using database schema column names)
    const allowedSortColumns = ['name', 'quantity', 'price', 'created_at', 'updated_at'];
    const validSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const validSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    console.log(`📦 ItemService - Getting items for business ${businessId}`);
    console.log(`📦 ItemService - Where clause: ${whereClause}`);
    console.log(`📦 ItemService - Query params:`, queryParams);

    // Get total count (using items table only for count)
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM items i ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count);
    console.log(`📦 ItemService - Total items found: ${total}`);

    // Get items with category information
    const itemsQuery = `
      SELECT 
        i.*,
        ic.name as category_name,
        ic1.name as category_1_name,
        ic2.name as category_2_name
      FROM items i
      LEFT JOIN item_categories ic ON i.category_id = ic.id AND ic.business_id = i.business_id
      LEFT JOIN item_categories ic1 ON i.category_1_id = ic1.id AND ic1.business_id = i.business_id
      LEFT JOIN item_categories ic2 ON i.category_2_id = ic2.id AND ic2.business_id = i.business_id
      ${whereClause}
      ORDER BY i.${validSortBy} ${validSortOrder}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    
    console.log(`📦 ItemService - Items query: ${itemsQuery}`);
    console.log(`📦 ItemService - Items query params:`, [...queryParams, limit, offset]);
    
    const itemsResult = await pool.query(itemsQuery, [...queryParams, limit, offset]);
    
    console.log(`📦 ItemService - Items returned: ${itemsResult.rows.length}`);
    if (itemsResult.rows.length > 0) {
      console.log(`📦 ItemService - Sample item:`, itemsResult.rows[0]);
    }

    const totalPages = Math.ceil(total / limit);

    // Transform database results to match Item interface
    const transformedItems = itemsResult.rows.map(row => ({
      id: row.id,
      business_id: row.business_id,
      code: `ITEM${String(row.id).padStart(3, '0')}`, // Generate code
      description: row.description || '',
      unit_price: parseFloat(row.price),
      uom: row.category || 'PCS',
      category: row.category,
      stock_quantity: row.quantity,
      is_active: true, // Default to active
      created_at: row.created_at,
      updated_at: row.updated_at,
      // Additional fields for frontend compatibility
      item_name: row.name, // Map 'name' to 'item_name'
      rate: parseFloat(row.price), // Map 'price' to 'rate'
      unit: row.category || 'PCS',
      quantity: row.quantity,
      amount: row.quantity * parseFloat(row.price), // Calculate amount
      buying_price: row.buying_price ? parseFloat(row.buying_price) : 0,
      selling_price: row.selling_price ? parseFloat(row.selling_price) : parseFloat(row.price),
      // Multiple categories
      category_id: row.category_id || null,
      category_1_id: row.category_1_id || null,
      category_2_id: row.category_2_id || null,
      category_name: row.category_name || null,
      category_1_name: row.category_1_name || null,
      category_2_name: row.category_2_name || null
    }));

    return {
      items: transformedItems,
      total,
      page,
      totalPages
    };
  }

  static async getItemById(businessId: number, itemId: number): Promise<Item | null> {
    const result = await pool.query(
      `SELECT 
        i.*,
        ic.name as category_name,
        ic1.name as category_1_name,
        ic2.name as category_2_name
      FROM items i
      LEFT JOIN item_categories ic ON i.category_id = ic.id AND ic.business_id = i.business_id
      LEFT JOIN item_categories ic1 ON i.category_1_id = ic1.id AND ic1.business_id = i.business_id
      LEFT JOIN item_categories ic2 ON i.category_2_id = ic2.id AND ic2.business_id = i.business_id
      WHERE i.id = $1 AND i.business_id = $2`,
      [itemId, businessId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    
    // Transform database result to match Item interface
    return {
      id: row.id,
      business_id: row.business_id,
      code: `ITEM${String(row.id).padStart(3, '0')}`,
      description: row.description || '',
      unit_price: parseFloat(row.price),
      uom: row.category || 'PCS',
      category: row.category,
      stock_quantity: row.quantity,
      is_active: true,
      created_at: row.created_at,
      updated_at: row.updated_at,
      // Additional fields for frontend compatibility
      item_name: row.name,
      rate: parseFloat(row.price),
      unit: row.category || 'PCS',
      quantity: row.quantity,
      amount: row.quantity * parseFloat(row.price),
      buying_price: row.buying_price ? parseFloat(row.buying_price) : 0,
      selling_price: row.selling_price ? parseFloat(row.selling_price) : parseFloat(row.price),
      // Multiple categories
      category_id: row.category_id || null,
      category_1_id: row.category_1_id || null,
      category_2_id: row.category_2_id || null,
      category_name: row.category_name || null,
      category_1_name: row.category_1_name || null,
      category_2_name: row.category_2_name || null
    };
  }

  static async updateItem(businessId: number, itemId: number, updateData: {
    item_name?: string;
    quantity?: number;
    buying_price?: number;
    selling_price?: number;
    rate?: number;
    unit?: string;
    description?: string;
    category_id?: number;
    category_1_id?: number;
    category_2_id?: number;
  }): Promise<Item | null> {
    const existingItem = await this.getItemById(businessId, itemId);
    if (!existingItem) {
      return null;
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    // Map frontend field names to database column names
    const fieldMapping: { [key: string]: string } = {
      'item_name': 'name',
      'quantity': 'quantity',
      'buying_price': 'buying_price',
      'selling_price': 'selling_price',
      'rate': 'price', // Map rate to price column
      'unit': 'category', // Map unit to category column (UOM)
      'description': 'description',
      'category_id': 'category_id',
      'category_1_id': 'category_1_id',
      'category_2_id': 'category_2_id'
    };

    // Build dynamic update query using correct column names
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined && fieldMapping[key]) {
        paramCount++;
        updates.push(`${fieldMapping[key]} = $${paramCount}`);
        values.push(value);
      }
    });

    // Update price column with selling_price if selling_price is provided
    if (updateData.selling_price !== undefined && !updateData.rate) {
      const priceIndex = updates.findIndex(update => update.startsWith('price ='));
      if (priceIndex === -1) {
        paramCount++;
        updates.push(`price = $${paramCount}`);
        values.push(updateData.selling_price);
      }
    }

    if (updates.length === 0) {
      return existingItem;
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

    const row = result.rows[0];
    
    // Get category names
    const categoryQuery = await pool.query(
      `SELECT 
        i.*,
        ic.name as category_name,
        ic1.name as category_1_name,
        ic2.name as category_2_name
      FROM items i
      LEFT JOIN item_categories ic ON i.category_id = ic.id AND ic.business_id = i.business_id
      LEFT JOIN item_categories ic1 ON i.category_1_id = ic1.id AND ic1.business_id = i.business_id
      LEFT JOIN item_categories ic2 ON i.category_2_id = ic2.id AND ic2.business_id = i.business_id
      WHERE i.id = $1 AND i.business_id = $2`,
      [itemId, businessId]
    );
    const itemWithCategories = categoryQuery.rows[0] || row;
    
    // Transform database result to match Item interface
    return {
      id: row.id,
      business_id: row.business_id,
      code: `ITEM${String(row.id).padStart(3, '0')}`,
      description: row.description || '',
      unit_price: parseFloat(row.price),
      uom: row.category || 'PCS',
      category: row.category,
      stock_quantity: row.quantity,
      is_active: true,
      created_at: row.created_at,
      updated_at: row.updated_at,
      // Additional fields for frontend compatibility
      item_name: row.name,
      rate: parseFloat(row.price),
      unit: row.category || 'PCS',
      quantity: row.quantity,
      amount: row.quantity * parseFloat(row.price),
      buying_price: row.buying_price ? parseFloat(row.buying_price) : 0,
      selling_price: row.selling_price ? parseFloat(row.selling_price) : parseFloat(row.price),
      // Multiple categories
      category_id: row.category_id || null,
      category_1_id: row.category_1_id || null,
      category_2_id: row.category_2_id || null,
      category_name: itemWithCategories.category_name || null,
      category_1_name: itemWithCategories.category_1_name || null,
      category_2_name: itemWithCategories.category_2_name || null
    };
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
         COALESCE(SUM(price * quantity), 0) as total_value,
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

  static async getItemsByExpiry(businessId: number, filter: 'expired' | 'today' | 'week' | 'month' | 'custom', startDate?: string, endDate?: string): Promise<Item[]> {
    let whereClause = 'WHERE i.business_id = $1 AND i.expiry_date IS NOT NULL';
    const queryParams: any[] = [businessId];
    let paramCount = 1;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    switch (filter) {
      case 'expired':
        // Items that have already expired (expiry_date < today)
        whereClause += ` AND i.expiry_date < $${++paramCount}`;
        queryParams.push(todayStr);
        break;
      case 'today':
        // Items expiring today
        whereClause += ` AND i.expiry_date = $${++paramCount}`;
        queryParams.push(todayStr);
        break;
      case 'week':
        // Items expiring within one week (today to 7 days from now)
        const weekFromNow = new Date(today);
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        const weekFromNowStr = weekFromNow.toISOString().split('T')[0];
        whereClause += ` AND i.expiry_date >= $${++paramCount} AND i.expiry_date <= $${++paramCount}`;
        queryParams.push(todayStr, weekFromNowStr);
        break;
      case 'month':
        // Items expiring within one month (today to 30 days from now)
        const monthFromNow = new Date(today);
        monthFromNow.setDate(monthFromNow.getDate() + 30);
        const monthFromNowStr = monthFromNow.toISOString().split('T')[0];
        whereClause += ` AND i.expiry_date >= $${++paramCount} AND i.expiry_date <= $${++paramCount}`;
        queryParams.push(todayStr, monthFromNowStr);
        break;
      case 'custom':
        // Custom date range
        if (startDate) {
          whereClause += ` AND i.expiry_date >= $${++paramCount}`;
          queryParams.push(startDate);
        }
        if (endDate) {
          whereClause += ` AND i.expiry_date <= $${++paramCount}`;
          queryParams.push(endDate);
        }
        break;
    }

    const query = `
      SELECT 
        i.*,
        ic.name as category_name,
        ic1.name as category_1_name,
        ic2.name as category_2_name
      FROM items i
      LEFT JOIN item_categories ic ON i.category_id = ic.id AND ic.business_id = i.business_id
      LEFT JOIN item_categories ic1 ON i.category_1_id = ic1.id AND ic1.business_id = i.business_id
      LEFT JOIN item_categories ic2 ON i.category_2_id = ic2.id AND ic2.business_id = i.business_id
      ${whereClause}
      ORDER BY i.expiry_date ASC`;

    const result = await pool.query(query, queryParams);

    return result.rows.map(row => ({
      id: row.id,
      business_id: row.business_id,
      code: `ITEM${String(row.id).padStart(3, '0')}`,
      description: row.description || '',
      unit_price: parseFloat(row.price),
      uom: row.category || 'PCS',
      category: row.category,
      stock_quantity: row.quantity,
      is_active: true,
      created_at: row.created_at,
      updated_at: row.updated_at,
      item_name: row.name,
      rate: parseFloat(row.price),
      unit: row.category || 'PCS',
      quantity: row.quantity,
      amount: row.quantity * parseFloat(row.price),
      buying_price: row.buying_price ? parseFloat(row.buying_price) : 0,
      selling_price: row.selling_price ? parseFloat(row.selling_price) : parseFloat(row.price),
      category_id: row.category_id || null,
      category_1_id: row.category_1_id || null,
      category_2_id: row.category_2_id || null,
      category_name: row.category_name || null,
      category_1_name: row.category_1_name || null,
      category_2_name: row.category_2_name || null,
      expiry_date: row.expiry_date || null,
      manufacturing_date: row.manufacturing_date || null
    }));
  }
}