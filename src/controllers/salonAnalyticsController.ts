import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import pool from '../database/connection';

// Get invoice analytics with filters
export const getInvoiceAnalytics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessId;
    const { filter = 'day' } = req.query; // day, week, month

    console.log(`📊 [Invoice Analytics] Fetching for business ${businessId}, filter: ${filter}`);

    let dateFilter = '';
    const params: any[] = [businessId];

    // Set date range based on filter
    const now = new Date();
    let startDate: Date;
    
    if (filter === 'day') {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (filter === 'week') {
      const dayOfWeek = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    }

    dateFilter = ` AND i.created_at >= $2`;
    params.push(startDate.toISOString());

    // Get invoices with their lines
    const invoicesQuery = `
      SELECT 
        i.id,
        i.invoice_number,
        i.customer_name,
        i.status,
        i.total_amount,
        i.amount_paid,
        (i.total_amount - COALESCE(i.amount_paid, 0)) as amount_due,
        i.created_at,
        i.issue_date,
        i.payment_method,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', il.id,
              'description', il.description,
              'quantity', il.quantity,
              'unit_price', il.unit_price,
              'total', il.total,
              'uom', il.uom
            )
          ) FILTER (WHERE il.id IS NOT NULL),
          '[]'::json
        ) as items
      FROM invoices i
      LEFT JOIN invoice_lines il ON i.id = il.invoice_id
      WHERE i.business_id = $1 
        AND i.notes LIKE '%Salon Bill%'
        ${dateFilter}
      GROUP BY i.id, i.invoice_number, i.customer_name, i.status, 
               i.total_amount, i.amount_paid, i.created_at, i.issue_date, i.payment_method
      ORDER BY i.created_at DESC
    `;

    console.log(`📊 [Invoice Analytics] Executing query with params:`, params);
    const result = await pool.query(invoicesQuery, params);
    console.log(`📊 [Invoice Analytics] Found ${result.rows.length} invoices`);

    res.json({
      success: true,
      data: result.rows,
      filter
    });
  } catch (error) {
    console.error('❌ [Invoice Analytics] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch invoice analytics' });
  }
};

// Get employee performance with service breakdown
export const getEmployeeServiceAnalytics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessId;
    const { filter = 'day' } = req.query;

    console.log(`👥 [Employee Analytics] Fetching for business ${businessId}, filter: ${filter}`);

    let dateFilter = '';
    const params: any[] = [businessId];

    // Set date range based on filter
    const now = new Date();
    let startDate: Date;
    
    if (filter === 'day') {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (filter === 'week') {
      const dayOfWeek = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    }

    dateFilter = ` AND t.transaction_date >= $2`;
    params.push(startDate.toISOString());

    const query = `
      SELECT 
        u.id as employee_id,
        CONCAT(u.first_name, ' ', u.last_name) as employee_name,
        srv.id as service_id,
        srv.name as service_name,
        COUNT(t.id) as service_count,
        COALESCE(SUM(t.service_price), 0) as service_total,
        COALESCE(AVG(t.service_price), 0) as avg_price
      FROM salon_transactions t
      JOIN users u ON t.employee_id = u.id
      JOIN salon_services srv ON t.service_id = srv.id
      WHERE t.business_id = $1 ${dateFilter}
      GROUP BY u.id, u.first_name, u.last_name, srv.id, srv.name
      ORDER BY u.first_name, u.last_name, service_total DESC
    `;

    console.log(`👥 [Employee Analytics] Executing query with params:`, params);
    const result = await pool.query(query, params);
    console.log(`👥 [Employee Analytics] Found ${result.rows.length} transaction rows`);

    // Group by employee
    const employeeMap = new Map();
    result.rows.forEach((row: any) => {
      if (!employeeMap.has(row.employee_id)) {
        employeeMap.set(row.employee_id, {
          employee_id: row.employee_id,
          employee_name: row.employee_name,
          services: [],
          total: 0
        });
      }
      const employee = employeeMap.get(row.employee_id);
      employee.services.push({
        service_id: row.service_id,
        service_name: row.service_name,
        count: parseInt(row.service_count),
        total: parseFloat(row.service_total),
        avg_price: parseFloat(row.avg_price)
      });
      employee.total += parseFloat(row.service_total);
    });

    const employees = Array.from(employeeMap.values());
    console.log(`👥 [Employee Analytics] Returning ${employees.length} employees`);
    
    res.json({
      success: true,
      data: employees,
      filter
    });
  } catch (error) {
    console.error('❌ [Employee Analytics] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch employee analytics' });
  }
};

// Get product sales analytics
export const getProductSalesAnalytics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessId;
    const { filter = 'day' } = req.query;

    console.log(`📦 [Product Sales Analytics] Fetching for business ${businessId}, filter: ${filter}`);

    let dateFilter = '';
    const params: any[] = [businessId];

    // Set date range based on filter
    const now = new Date();
    let startDate: Date;
    
    if (filter === 'day') {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (filter === 'week') {
      const dayOfWeek = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    }

    dateFilter = ` AND inv.created_at >= $2`;
    params.push(startDate.toISOString());

    const query = `
      SELECT 
        il.item_id,
        i.name as item_name,
        COALESCE(il.uom, 'PCS') as unit,
        SUM(il.quantity) as total_quantity,
        COALESCE(SUM(il.total), SUM(il.quantity * il.unit_price), 0) as total_revenue,
        COALESCE(AVG(il.unit_price), 0) as avg_price,
        COUNT(DISTINCT il.invoice_id) as invoice_count
      FROM invoice_lines il
      JOIN invoices inv ON il.invoice_id = inv.id
      JOIN items i ON il.item_id = i.id
      WHERE inv.business_id = $1 
        AND inv.notes LIKE '%Salon Bill%'
        AND il.item_id IS NOT NULL
        ${dateFilter}
      GROUP BY il.item_id, i.name, il.uom
      ORDER BY total_revenue DESC
    `;

    console.log(`📦 [Product Sales Analytics] Executing query:`, query);
    console.log(`📦 [Product Sales Analytics] Query params:`, params);
    const result = await pool.query(query, params);
    console.log(`📦 [Product Sales Analytics] Found ${result.rows.length} products`);

    const products = result.rows.map((row: any) => ({
      item_id: row.item_id,
      item_name: row.item_name,
      unit: row.unit,
      total_quantity: parseFloat(row.total_quantity),
      total_revenue: parseFloat(row.total_revenue),
      avg_price: parseFloat(row.avg_price),
      invoice_count: parseInt(row.invoice_count)
    }));
    console.log(`📦 [Product Sales Analytics] Returning ${products.length} products`);
    
    res.json({
      success: true,
      data: products,
      filter
    });
  } catch (error) {
    console.error('❌ [Product Sales Analytics] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch product sales analytics' });
  }
};

// Get service sales analytics
export const getServiceSalesAnalytics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessId;
    const { filter = 'day' } = req.query;

    console.log(`💇 [Service Sales Analytics] Fetching for business ${businessId}, filter: ${filter}`);

    let dateFilter = '';
    const params: any[] = [businessId];

    // Set date range based on filter
    const now = new Date();
    let startDate: Date;
    
    if (filter === 'day') {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (filter === 'week') {
      const dayOfWeek = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    }

    dateFilter = ` AND t.transaction_date >= $2`;
    params.push(startDate.toISOString());

    const query = `
      SELECT 
        srv.id as service_id,
        srv.name as service_name,
        COUNT(t.id) as service_count,
        COALESCE(SUM(t.service_price), 0) as total_revenue,
        COALESCE(AVG(t.service_price), 0) as avg_price
      FROM salon_transactions t
      JOIN salon_services srv ON t.service_id = srv.id
      WHERE t.business_id = $1 ${dateFilter}
      GROUP BY srv.id, srv.name
      ORDER BY total_revenue DESC
    `;

    console.log(`💇 [Service Sales Analytics] Executing query with params:`, params);
    const result = await pool.query(query, params);
    console.log(`💇 [Service Sales Analytics] Found ${result.rows.length} services`);

    const services = result.rows.map((row: any) => ({
      service_id: row.service_id,
      service_name: row.service_name,
      count: parseInt(row.service_count),
      total_revenue: parseFloat(row.total_revenue),
      avg_price: parseFloat(row.avg_price)
    }));
    console.log(`💇 [Service Sales Analytics] Returning ${services.length} services`);
    
    res.json({
      success: true,
      data: services,
      filter
    });
  } catch (error) {
    console.error('❌ [Service Sales Analytics] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch service sales analytics' });
  }
};

// Get best and worst performing products and services
export const getBestWorstPerformers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessId;
    const { filter = 'day' } = req.query;

    console.log(`🏆 [Best/Worst Performers] Fetching for business ${businessId}, filter: ${filter}`);

    let dateFilter = '';
    const params: any[] = [businessId];

    // Set date range based on filter
    const now = new Date();
    let startDate: Date;
    
    if (filter === 'day') {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (filter === 'week') {
      const dayOfWeek = now.getDay();
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    }

    dateFilter = ` AND created_at >= $2`;
    params.push(startDate.toISOString());

    // Best and worst products
    const productsQuery = `
      SELECT 
        il.item_id,
        i.name as item_name,
        SUM(il.quantity) as total_quantity,
        COALESCE(SUM(il.total), SUM(il.quantity * il.unit_price), 0) as total_revenue
      FROM invoice_lines il
      JOIN invoices inv ON il.invoice_id = inv.id
      JOIN items i ON il.item_id = i.id
      WHERE inv.business_id = $1 
        AND inv.notes LIKE '%Salon Bill%'
        AND il.item_id IS NOT NULL
        AND inv.created_at >= $2
      GROUP BY il.item_id, i.name
      ORDER BY total_revenue DESC
    `;

    console.log(`🏆 [Best/Worst Performers] Executing products query with params:`, params);
    const productsResult = await pool.query(productsQuery, params);
    console.log(`🏆 [Best/Worst Performers] Found ${productsResult.rows.length} products`);
    
    const products = productsResult.rows.map((row: any) => ({
      item_id: row.item_id,
      item_name: row.item_name,
      total_quantity: parseFloat(row.total_quantity),
      total_revenue: parseFloat(row.total_revenue)
    }));

    // Best and worst services
    const servicesQuery = `
      SELECT 
        srv.id as service_id,
        srv.name as service_name,
        COUNT(t.id) as service_count,
        COALESCE(SUM(t.service_price), 0) as total_revenue
      FROM salon_transactions t
      JOIN salon_services srv ON t.service_id = srv.id
      WHERE t.business_id = $1 
        AND t.transaction_date >= $2
      GROUP BY srv.id, srv.name
      ORDER BY total_revenue DESC
    `;

    console.log(`🏆 [Best/Worst Performers] Executing services query with params:`, params);
    const servicesResult = await pool.query(servicesQuery, params);
    console.log(`🏆 [Best/Worst Performers] Found ${servicesResult.rows.length} services`);
    
    const services = servicesResult.rows.map((row: any) => ({
      service_id: row.service_id,
      service_name: row.service_name,
      count: parseInt(row.service_count),
      total_revenue: parseFloat(row.total_revenue)
    }));

    console.log(`🏆 [Best/Worst Performers] Returning best/worst performers`);
    res.json({
      success: true,
      data: {
        products: {
          best: products.slice(0, 5),
          worst: products.slice(-5).reverse()
        },
        services: {
          best: services.slice(0, 5),
          worst: services.slice(-5).reverse()
        }
      },
      filter
    });
  } catch (error) {
    console.error('❌ [Best/Worst Performers] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch performers data' });
  }
};

// Get low stock products
export const getLowStockProducts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessId = req.businessId;

    console.log(`⚠️ [Low Stock] Fetching for business ${businessId}`);

    const query = `
      SELECT 
        i.id,
        i.name as item_name,
        COALESCE(i.quantity, 0) as current_stock,
        COALESCE(i.reorder_level, 0) as reorder_level,
        COALESCE(i.category, 'PCS') as unit,
        c.name as category_name
      FROM items i
      LEFT JOIN item_categories c ON i.category_id = c.id
      WHERE i.business_id = $1
        AND COALESCE(i.quantity, 0) <= COALESCE(i.reorder_level, 0)
        AND COALESCE(i.quantity, 0) >= 0
      ORDER BY current_stock ASC, i.name
    `;

    console.log(`⚠️ [Low Stock] Executing query:`, query);
    const result = await pool.query(query, [businessId]);
    console.log(`⚠️ [Low Stock] Found ${result.rows.length} low stock items`);

    const lowStockItems = result.rows.map((row: any) => ({
      id: row.id,
      item_name: row.item_name,
      current_stock: parseFloat(row.current_stock || 0),
      reorder_level: parseFloat(row.reorder_level || 0),
      unit: row.unit,
      category_name: row.category_name
    }));
    console.log(`⚠️ [Low Stock] Returning ${lowStockItems.length} items`);
    
    res.json({
      success: true,
      data: lowStockItems
    });
  } catch (error) {
    console.error('❌ [Low Stock] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch low stock products' });
  }
};

