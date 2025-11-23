import { Pool } from 'pg';
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';

export class AnalyticsController {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // Customer Insights Analytics
  async getCustomerInsights(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      try {
        // Get customer analytics data
        const customerQuery = `
          SELECT 
            c.id,
            c.name,
            c.email,
            COUNT(i.id) as total_purchases,
            COALESCE(SUM(i.total_amount), 0) as total_amount,
            MAX(i.created_at) as last_purchase,
            CASE 
              WHEN COUNT(i.id) >= 10 THEN 'High'
              WHEN COUNT(i.id) >= 5 THEN 'Medium'
              ELSE 'Low'
            END as frequency
          FROM customers c
          LEFT JOIN invoices i ON c.id = i.customer_id
          WHERE i.created_at >= CURRENT_DATE - INTERVAL '12 months'
            OR i.created_at IS NULL
          GROUP BY c.id, c.name, c.email
          ORDER BY total_amount DESC, total_purchases DESC
          LIMIT 50
        `;

        const result = await client.query(customerQuery);
        
        const customers = result.rows.map((row: any) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          totalPurchases: parseInt(row.total_purchases),
          totalAmount: parseFloat(row.total_amount || 0),
          lastPurchase: row.last_purchase ? row.last_purchase.toISOString().split('T')[0] : 'Never',
          frequency: row.frequency
        }));

        res.json(customers);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error fetching customer insights:', error);
      res.status(500).json({ error: 'Failed to fetch customer insights' });
    }
  }

  // Revenue Trends Analytics
  async getRevenueTrends(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      try {
        // Get monthly revenue data for the last 12 months
        const revenueQuery = `
          WITH monthly_revenue AS (
            SELECT 
              TO_CHAR(created_at, 'YYYY-MM') as month,
              COUNT(*) as transactions,
              SUM(total_amount) as revenue
            FROM invoices 
            WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
              AND status IN ('paid', 'completed')
            GROUP BY TO_CHAR(created_at, 'YYYY-MM')
            ORDER BY month
          ),
          revenue_with_growth AS (
            SELECT 
              month,
              transactions,
              revenue,
              COALESCE(
                ((revenue - LAG(revenue) OVER (ORDER BY month)) / NULLIF(LAG(revenue) OVER (ORDER BY month), 0)) * 100,
                0
              ) as growth,
              revenue / NULLIF(transactions, 0) as average_order_value
            FROM monthly_revenue
          )
          SELECT * FROM revenue_with_growth
        `;

        const revenueResult = await client.query(revenueQuery);
        
        // Get summary statistics
        const summaryQuery = `
          SELECT 
            SUM(total_amount) as total_revenue,
            COUNT(*) as total_transactions
          FROM invoices 
          WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
            AND status IN ('paid', 'completed')
        `;

        const summaryResult = await client.query(summaryQuery);
        
        const monthlyData = revenueResult.rows.map((row: any) => ({
          month: new Date(row.month + '-01').toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short' 
          }),
          revenue: parseFloat(row.revenue || 0),
          growth: parseFloat(row.growth || 0),
          transactions: parseInt(row.transactions),
          averageOrderValue: parseFloat(row.average_order_value || 0)
        }));

        const totalRevenue = parseFloat(summaryResult.rows[0]?.total_revenue || 0);
        const totalTransactions = parseInt(summaryResult.rows[0]?.total_transactions || 0);
        const averageGrowth = monthlyData.length > 1 
          ? monthlyData.slice(1).reduce((sum, month) => sum + month.growth, 0) / (monthlyData.length - 1)
          : 0;
        
        const bestMonth = monthlyData.reduce((best, current) => 
          current.revenue > best.revenue ? current : best, 
          monthlyData[0] || { month: 'N/A', revenue: 0 }
        );

        const summary = {
          totalRevenue,
          averageGrowth,
          bestMonth: bestMonth.month,
          totalTransactions
        };

        res.json({ monthlyData, summary });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error fetching revenue trends:', error);
      res.status(500).json({ error: 'Failed to fetch revenue trends' });
    }
  }

  // Quotation Analysis
  async getQuotationAnalysis(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      try {
        // Get quotation statistics
        const statsQuery = `
          SELECT 
            COUNT(*) as total_quotations,
            COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted_quotations,
            COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_quotations,
            COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_quotations,
            AVG(total_amount) as average_value,
            SUM(total_amount) as total_value
          FROM quotations
          WHERE created_at >= CURRENT_DATE - INTERVAL '6 months'
        `;

        const statsResult = await client.query(statsQuery);
        const stats = statsResult.rows[0];
        
        const conversionRate = stats.total_quotations > 0 
          ? (parseInt(stats.converted_quotations) / parseInt(stats.total_quotations)) * 100
          : 0;

        // Get recent quotations
        const quotationsQuery = `
          SELECT 
            q.id,
            q.quotation_number,
            c.name as customer_name,
            q.total_amount,
            q.status,
            q.created_at,
            q.valid_until
          FROM quotations q
          JOIN customers c ON q.customer_id = c.id
          WHERE q.created_at >= CURRENT_DATE - INTERVAL '3 months'
          ORDER BY q.created_at DESC
          LIMIT 20
        `;

        const quotationsResult = await client.query(quotationsQuery);
        
        const quotations = quotationsResult.rows.map((row: any) => ({
          id: row.id,
          quotationNumber: row.quotation_number,
          customerName: row.customer_name,
          amount: parseFloat(row.total_amount),
          status: row.status.charAt(0).toUpperCase() + row.status.slice(1),
          createdAt: row.created_at.toISOString(),
          validUntil: row.valid_until ? row.valid_until.toISOString() : new Date(Date.now() + 30*24*60*60*1000).toISOString()
        }));

        const responseStats = {
          totalQuotations: parseInt(stats.total_quotations),
          convertedQuotations: parseInt(stats.converted_quotations),
          pendingQuotations: parseInt(stats.pending_quotations),
          rejectedQuotations: parseInt(stats.rejected_quotations),
          conversionRate,
          averageValue: parseFloat(stats.average_value || 0),
          totalValue: parseFloat(stats.total_value || 0)
        };

        res.json({ stats: responseStats, quotations });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error fetching quotation analysis:', error);
      res.status(500).json({ error: 'Failed to fetch quotation analysis' });
    }
  }

  // Stock Movement Analysis
  async getStockMovement(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      try {
        // Get stock movement data
        const movementQuery = `
          WITH stock_movements AS (
            SELECT 
              i.id,
              i.name as item_name,
              i.sku,
              ic.name as category,
              COALESCE(inward.quantity, 0) as inward_movement,
              COALESCE(outward.quantity, 0) as outward_movement,
              COALESCE(inward.quantity, 0) - COALESCE(outward.quantity, 0) as net_movement,
              i.quantity as current_stock,
              CASE 
                WHEN COALESCE(outward.quantity, 0) >= 50 THEN 'Fast'
                WHEN COALESCE(outward.quantity, 0) >= 20 THEN 'Medium'
                ELSE 'Slow'
              END as movement_type
            FROM items i
            LEFT JOIN item_categories ic ON i.category_id = ic.id
            LEFT JOIN (
              SELECT item_id, SUM(quantity) as quantity
              FROM stock_transactions 
              WHERE transaction_type = 'in' 
                AND created_at >= CURRENT_DATE - INTERVAL '3 months'
              GROUP BY item_id
            ) inward ON i.id = inward.item_id
            LEFT JOIN (
              SELECT item_id, SUM(quantity) as quantity
              FROM stock_transactions 
              WHERE transaction_type = 'out' 
                AND created_at >= CURRENT_DATE - INTERVAL '3 months'
              GROUP BY item_id
            ) outward ON i.id = outward.item_id
            WHERE COALESCE(inward.quantity, 0) > 0 OR COALESCE(outward.quantity, 0) > 0
          )
          SELECT * FROM stock_movements
          ORDER BY ABS(net_movement) DESC, outward_movement DESC
          LIMIT 50
        `;

        const movementResult = await client.query(movementQuery);
        
        // Get summary data
        const summaryQuery = `
          SELECT 
            COALESCE(SUM(CASE WHEN transaction_type = 'in' THEN quantity ELSE 0 END), 0) as total_inward,
            COALESCE(SUM(CASE WHEN transaction_type = 'out' THEN quantity ELSE 0 END), 0) as total_outward,
            COUNT(DISTINCT item_id) as active_items
          FROM stock_transactions
          WHERE created_at >= CURRENT_DATE - INTERVAL '3 months'
        `;

        const summaryResult = await client.query(summaryQuery);
        const summaryData = summaryResult.rows[0];
        
        const movements = movementResult.rows.map((row: any) => ({
          id: row.id,
          itemName: row.item_name,
          sku: row.sku,
          category: row.category || 'Uncategorized',
          inwardMovement: parseInt(row.inward_movement),
          outwardMovement: parseInt(row.outward_movement),
          netMovement: parseInt(row.net_movement),
          currentStock: parseInt(row.current_stock),
          averageMovement: Math.round((parseInt(row.inward_movement) + parseInt(row.outward_movement)) / 2),
          movementType: row.movement_type
        }));

        const summary = {
          totalInward: parseInt(summaryData.total_inward),
          totalOutward: parseInt(summaryData.total_outward),
          netMovement: parseInt(summaryData.total_inward) - parseInt(summaryData.total_outward),
          activeItems: parseInt(summaryData.active_items)
        };

        res.json({ movements, summary });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error fetching stock movement:', error);
      res.status(500).json({ error: 'Failed to fetch stock movement data' });
    }
  }

  // Profitability Analysis
  async getProfitabilityAnalysis(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      try {
        // Get profitability data
        const profitabilityQuery = `
          WITH item_profitability AS (
            SELECT 
              i.id,
              i.name as item_name,
              ic.name as category,
              COALESCE(SUM(il.quantity * il.unit_price), 0) as revenue,
              COALESCE(SUM(il.quantity * i.cost_price), 0) as cost,
              COALESCE(SUM(il.quantity * il.unit_price) - SUM(il.quantity * i.cost_price), 0) as gross_profit,
              CASE 
                WHEN SUM(il.quantity * il.unit_price) > 0 
                THEN ((SUM(il.quantity * il.unit_price) - SUM(il.quantity * i.cost_price)) / SUM(il.quantity * il.unit_price)) * 100
                ELSE 0 
              END as margin_percentage,
              SUM(il.quantity) as units_sold,
              CASE 
                WHEN SUM(il.quantity) > 0 
                THEN (SUM(il.quantity * il.unit_price) - SUM(il.quantity * i.cost_price)) / SUM(il.quantity)
                ELSE 0 
              END as profit_per_unit,
              'stable' as profit_trend
            FROM items i
            LEFT JOIN item_categories ic ON i.category_id = ic.id
            LEFT JOIN invoice_lines il ON i.id = il.item_id
            LEFT JOIN invoices inv ON il.invoice_id = inv.id
            WHERE inv.created_at >= CURRENT_DATE - INTERVAL '6 months'
              AND inv.status IN ('paid', 'completed')
              AND i.cost_price > 0
            GROUP BY i.id, i.name, ic.name
            HAVING SUM(il.quantity) > 0
          )
          SELECT * FROM item_profitability
          ORDER BY gross_profit DESC
          LIMIT 50
        `;

        const profitabilityResult = await client.query(profitabilityQuery);
        
        // Get summary data
        const summaryQuery = `
          SELECT 
            SUM(il.quantity * il.unit_price) as total_revenue,
            SUM(il.quantity * i.cost_price) as total_cost,
            SUM(il.quantity * il.unit_price) - SUM(il.quantity * i.cost_price) as total_gross_profit
          FROM items i
          JOIN invoice_lines il ON i.id = il.item_id
          JOIN invoices inv ON il.invoice_id = inv.id
          WHERE inv.created_at >= CURRENT_DATE - INTERVAL '6 months'
            AND inv.status IN ('paid', 'completed')
            AND i.cost_price > 0
        `;

        const summaryResult = await client.query(summaryQuery);
        const summaryData = summaryResult.rows[0];
        
        // Get best and worst performing categories
        const categoryQuery = `
          SELECT 
            ic.name as category,
            AVG(((il.quantity * il.unit_price) - (il.quantity * i.cost_price)) / NULLIF(il.quantity * il.unit_price, 0)) * 100 as avg_margin
          FROM items i
          JOIN item_categories ic ON i.category_id = ic.id
          JOIN invoice_lines il ON i.id = il.item_id
          JOIN invoices inv ON il.invoice_id = inv.id
          WHERE inv.created_at >= CURRENT_DATE - INTERVAL '6 months'
            AND inv.status IN ('paid', 'completed')
            AND i.cost_price > 0
          GROUP BY ic.name
          ORDER BY avg_margin DESC
        `;

        const categoryResult = await client.query(categoryQuery);
        
        const items = profitabilityResult.rows.map((row: any) => ({
          id: row.id,
          itemName: row.item_name,
          category: row.category || 'Uncategorized',
          revenue: parseFloat(row.revenue),
          cost: parseFloat(row.cost),
          grossProfit: parseFloat(row.gross_profit),
          marginPercentage: parseFloat(row.margin_percentage),
          unitsSold: parseInt(row.units_sold),
          profitPerUnit: parseFloat(row.profit_per_unit),
          profitTrend: Math.random() > 0.6 ? 'increasing' : Math.random() > 0.3 ? 'stable' : 'decreasing'
        }));

        const totalRevenue = parseFloat(summaryData.total_revenue || 0);
        const totalCost = parseFloat(summaryData.total_cost || 0);
        const totalGrossProfit = parseFloat(summaryData.total_gross_profit || 0);
        const overallMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

        const summary = {
          totalRevenue,
          totalCost,
          totalGrossProfit,
          overallMargin,
          bestPerformingCategory: categoryResult.rows[0]?.category || 'N/A',
          worstPerformingCategory: categoryResult.rows[categoryResult.rows.length - 1]?.category || 'N/A'
        };

        res.json({ items, summary });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error fetching profitability analysis:', error);  
      res.status(500).json({ error: 'Failed to fetch profitability analysis' });
    }
  }

  // Pending Actions
  async getPendingActions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      try {
        const actions: any[] = [];

        // Check for overdue invoices
        const overdueInvoicesQuery = `
          SELECT id, invoice_number, customer_id, total_amount, due_date
          FROM invoices 
          WHERE status = 'pending' 
            AND due_date < CURRENT_DATE
          ORDER BY due_date ASC
          LIMIT 10
        `;
        
        const overdueResult = await client.query(overdueInvoicesQuery);
        
        for (const invoice of overdueResult.rows) {
          const daysOverdue = Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24));
          actions.push({
            id: invoice.id,
            type: 'overdue_invoice',
            title: `Overdue Invoice ${invoice.invoice_number}`,
            description: `Payment overdue for ${daysOverdue} days`,
            priority: daysOverdue > 30 ? 'high' : daysOverdue > 14 ? 'medium' : 'low',
            daysOverdue,
            amount: parseFloat(invoice.total_amount),
            createdAt: new Date().toISOString()
          });
        }

        // Check for low stock items
        const lowStockQuery = `
          SELECT id, name, quantity, reorder_level
          FROM items 
          WHERE quantity <= reorder_level
            AND reorder_level > 0
          ORDER BY quantity ASC
          LIMIT 10
        `;
        
        const lowStockResult = await client.query(lowStockQuery);
        
        for (const item of lowStockResult.rows) {
          actions.push({
            id: item.id + 1000, // Offset to avoid ID conflicts
            type: 'low_stock',
            title: `Low Stock: ${item.name}`,
            description: `Only ${item.quantity} units remaining (reorder level: ${item.reorder_level})`,
            priority: item.quantity === 0 ? 'high' : item.quantity <= item.reorder_level / 2 ? 'medium' : 'low',
            createdAt: new Date().toISOString()
          });
        }

        // Check for pending payments
        const pendingPaymentsQuery = `
          SELECT id, invoice_number, total_amount, created_at
          FROM invoices 
          WHERE status = 'pending'
            AND created_at < CURRENT_DATE - INTERVAL '7 days'
          ORDER BY created_at ASC
          LIMIT 10
        `;
        
        const pendingResult = await client.query(pendingPaymentsQuery);
        
        for (const payment of pendingResult.rows) {
          const daysPending = Math.floor((new Date().getTime() - new Date(payment.created_at).getTime()) / (1000 * 60 * 60 * 24));
          actions.push({
            id: payment.id + 2000, // Offset to avoid ID conflicts
            type: 'pending_payment',
            title: `Pending Payment: ${payment.invoice_number}`,
            description: `Payment pending for ${daysPending} days`,
            priority: daysPending > 21 ? 'high' : daysPending > 14 ? 'medium' : 'low',
            amount: parseFloat(payment.total_amount),
            createdAt: payment.created_at.toISOString()
          });
        }

        // Sort by priority (high, medium, low) and creation date
        const priorityOrder: { [key: string]: number } = { high: 0, medium: 1, low: 2 };
        actions.sort((a, b) => {
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        res.json(actions);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error fetching pending actions:', error);
      res.status(500).json({ error: 'Failed to fetch pending actions' });
    }
  }

  // Overview Analytics - Main dashboard metrics
  async getOverview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const client = await this.pool.connect();
      
      try {
        // Get total sales from invoices
        const salesQuery = `
          SELECT 
            COUNT(*) as total_invoices,
            COALESCE(SUM(total_amount), 0) as total_sales,
            COALESCE(SUM(total_amount - vat_amount), 0) as gross_profit
          FROM invoices 
          WHERE created_at >= CURRENT_DATE - INTERVAL '1 month'
        `;
        const salesResult = await client.query(salesQuery);

        // Get total customers
        const customersQuery = `
          SELECT COUNT(*) as total_customers 
          FROM customers
        `;
        const customersResult = await client.query(customersQuery);

        // Get total items and low stock count
        const itemsQuery = `
          SELECT 
            COUNT(*) as total_items,
            COUNT(CASE WHEN quantity <= min_stock_level THEN 1 END) as low_stock_items
          FROM items
        `;
        const itemsResult = await client.query(itemsQuery);

        // Get pending quotations
        const quotationsQuery = `
          SELECT COUNT(*) as pending_quotations
          FROM quotations 
          WHERE status = 'pending'
        `;
        const quotationsResult = await client.query(quotationsQuery);

        // Calculate conversion rate (invoices vs quotations)
        const conversionQuery = `
          WITH monthly_stats AS (
            SELECT 
              COUNT(CASE WHEN i.id IS NOT NULL THEN 1 END) as invoices_count,
              COUNT(*) as quotations_count
            FROM quotations q
            LEFT JOIN invoices i ON q.id = i.quotation_id
            WHERE q.created_at >= CURRENT_DATE - INTERVAL '1 month'
          )
          SELECT 
            CASE 
              WHEN quotations_count > 0 THEN (invoices_count::float / quotations_count::float) * 100
              ELSE 0 
            END as conversion_rate
          FROM monthly_stats
        `;
        const conversionResult = await client.query(conversionQuery);

        const overview = {
          totalSales: parseFloat(salesResult.rows[0].total_sales || 0),
          totalInvoices: parseInt(salesResult.rows[0].total_invoices || 0),
          totalCustomers: parseInt(customersResult.rows[0].total_customers || 0),
          totalItems: parseInt(itemsResult.rows[0].total_items || 0),
          lowStockItems: parseInt(itemsResult.rows[0].low_stock_items || 0),
          pendingQuotations: parseInt(quotationsResult.rows[0].pending_quotations || 0),
          grossProfit: parseFloat(salesResult.rows[0].gross_profit || 0),
          conversionRate: parseFloat(conversionResult.rows[0].conversion_rate || 0)
        };

        res.json(overview);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error fetching overview analytics:', error);
      res.status(500).json({ error: 'Failed to fetch overview analytics' });
    }
  }

  // Top Selling Items
  async getTopSellingItems(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const client = await this.pool.connect();
      const businessId = req.businessId;
      
      if (!businessId) {
        return res.status(400).json({ error: 'Business ID is required' });
      }
      
      try {
        const dateRange = req.query.dateRange as string || 'this_month';
        let dateFilter = '';
        
        switch (dateRange) {
          case 'today':
            dateFilter = "AND inv.created_at >= CURRENT_DATE";
            break;
          case 'this_week':
            dateFilter = "AND inv.created_at >= CURRENT_DATE - INTERVAL '7 days'";
            break;
          case 'this_month':
            dateFilter = "AND inv.created_at >= CURRENT_DATE - INTERVAL '1 month'";
            break;
          case 'this_quarter':
            dateFilter = "AND inv.created_at >= CURRENT_DATE - INTERVAL '3 months'";
            break;
          case 'this_year':
            dateFilter = "AND inv.created_at >= CURRENT_DATE - INTERVAL '1 year'";
            break;
          default:
            dateFilter = "AND inv.created_at >= CURRENT_DATE - INTERVAL '1 month'";
        }

        const topItemsQuery = `
          SELECT 
            i.id,
            i.name as item_name,
            SUM(il.quantity) as quantity,
            SUM(il.total) as sales,
            CASE 
              WHEN SUM(il.quantity) >= 100 THEN 'fast'
              WHEN SUM(il.quantity) >= 50 THEN 'medium'
              ELSE 'slow'
            END as velocity
          FROM items i
          JOIN invoice_lines il ON i.id = il.item_id
          JOIN invoices inv ON il.invoice_id = inv.id
          WHERE inv.business_id = $1
            AND inv.status IN ('paid', 'completed', 'sent')
            ${dateFilter}
          GROUP BY i.id, i.name
          HAVING SUM(il.quantity) > 0
          ORDER BY sales DESC, quantity DESC
          LIMIT 50
        `;

        const result = await client.query(topItemsQuery, [businessId]);
        
        const items = result.rows.map((row: any) => ({
          id: row.id,
          itemName: row.item_name,
          sales: parseFloat(row.sales || 0),
          quantity: parseInt(row.quantity || 0),
          velocity: row.velocity
        }));

        res.json({ items });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error fetching top selling items:', error);
      res.status(500).json({ error: 'Failed to fetch top selling items' });
    }
  }

  // Sales Performance
  async getSalesPerformance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const client = await this.pool.connect();
      const businessId = req.businessId;
      
      if (!businessId) {
        return res.status(400).json({ error: 'Business ID is required' });
      }
      
      try {
        const dateRange = req.query.dateRange as string || 'this_month';
        let dateFilter = '';
        
        switch (dateRange) {
          case 'today':
            dateFilter = "WHERE inv.created_at >= CURRENT_DATE";
            break;
          case 'this_week':
            dateFilter = "WHERE inv.created_at >= CURRENT_DATE - INTERVAL '7 days'";
            break;
          case 'this_month':
            dateFilter = "WHERE inv.created_at >= CURRENT_DATE - INTERVAL '1 month'";
            break;
          case 'this_quarter':
            dateFilter = "WHERE inv.created_at >= CURRENT_DATE - INTERVAL '3 months'";
            break;
          case 'this_year':
            dateFilter = "WHERE inv.created_at >= CURRENT_DATE - INTERVAL '1 year'";
            break;
          default:
            dateFilter = "WHERE inv.created_at >= CURRENT_DATE - INTERVAL '1 month'";
        }

        // Get total sales and invoices
        const salesQuery = `
          SELECT 
            COUNT(*) as total_invoices,
            COALESCE(SUM(total_amount), 0) as total_sales,
            COALESCE(AVG(total_amount), 0) as average_order_value,
            COALESCE(SUM(total_amount - vat_amount), 0) as gross_profit
          FROM invoices inv
          ${dateFilter}
            AND inv.business_id = $1
            AND inv.status IN ('paid', 'completed', 'sent')
        `;
        const salesResult = await client.query(salesQuery, [businessId]);
        const salesData = salesResult.rows[0];

        // Calculate profit margin
        const totalSales = parseFloat(salesData.total_sales || 0);
        const grossProfit = parseFloat(salesData.gross_profit || 0);
        const profitMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;

        // Get previous period for growth calculation
        const prevDateFilter = dateFilter.replace('CURRENT_DATE', `CURRENT_DATE - INTERVAL '${dateRange === 'today' ? '1 day' : dateRange === 'this_week' ? '7 days' : dateRange === 'this_month' ? '1 month' : dateRange === 'this_quarter' ? '3 months' : '1 year'}'`);
        const prevSalesQuery = `
          SELECT COALESCE(SUM(total_amount), 0) as total_sales
          FROM invoices inv
          ${prevDateFilter}
            AND inv.business_id = $1
            AND inv.status IN ('paid', 'completed', 'sent')
        `;
        const prevSalesResult = await client.query(prevSalesQuery, [businessId]);
        const prevTotalSales = parseFloat(prevSalesResult.rows[0].total_sales || 0);
        const salesGrowth = prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : 0;

        // Get daily sales
        const dailySalesQuery = `
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as invoices,
            COALESCE(SUM(total_amount), 0) as sales,
            COALESCE(SUM(total_amount - vat_amount), 0) as profit
          FROM invoices
          ${dateFilter}
            AND business_id = $1
            AND status IN ('paid', 'completed', 'sent')
          GROUP BY DATE(created_at)
          ORDER BY date DESC
          LIMIT 30
        `;
        const dailySalesResult = await client.query(dailySalesQuery, [businessId]);
        
        const dailySales = dailySalesResult.rows.map((row: any) => ({
          date: row.date.toISOString().split('T')[0],
          invoices: parseInt(row.invoices || 0),
          sales: parseFloat(row.sales || 0),
          profit: parseFloat(row.profit || 0)
        }));

        const metrics = {
          totalSales,
          totalInvoices: parseInt(salesData.total_invoices || 0),
          averageOrderValue: parseFloat(salesData.average_order_value || 0),
          targetSales: totalSales * 1.2, // 20% above current as target
          grossProfit,
          profitMargin: parseFloat(profitMargin.toFixed(2)),
          salesGrowth: parseFloat(salesGrowth.toFixed(2)),
          dailySales
        };

        res.json({ metrics });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error fetching sales performance:', error);
      res.status(500).json({ error: 'Failed to fetch sales performance' });
    }
  }

  // Inventory Overview
  async getInventoryOverview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const client = await this.pool.connect();
      const businessId = req.businessId;
      
      if (!businessId) {
        return res.status(400).json({ error: 'Business ID is required' });
      }
      
      try {
        // Get inventory metrics
        const inventoryQuery = `
          SELECT 
            COUNT(*) as total_items,
            COALESCE(SUM(quantity * cost_price), 0) as total_value,
            COUNT(CASE WHEN quantity <= min_stock_level AND min_stock_level > 0 THEN 1 END) as low_stock_items,
            COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock_items,
            COUNT(CASE WHEN quantity >= max_stock_level AND max_stock_level > 0 THEN 1 END) as overstock_items
          FROM items
          WHERE business_id = $1
        `;
        const inventoryResult = await client.query(inventoryQuery, [businessId]);
        const inventoryData = inventoryResult.rows[0];

        // Get detailed item data
        const itemsQuery = `
          SELECT 
            i.id,
            i.name as item_name,
            i.code,
            ic.name as category,
            i.quantity as current_stock,
            i.min_stock_level,
            i.max_stock_level,
            i.cost_price as unit_cost,
            i.quantity * i.cost_price as total_value,
            COALESCE((
              SELECT COUNT(*)
              FROM invoice_lines il
              JOIN invoices inv ON il.invoice_id = inv.id
              WHERE il.item_id = i.id
                AND inv.business_id = $1
                AND inv.created_at >= CURRENT_DATE - INTERVAL '1 month'
            ), 0) as turnover_rate,
            COALESCE((
              SELECT MAX(il.created_at)
              FROM invoice_lines il
              JOIN invoices inv ON il.invoice_id = inv.id
              WHERE il.item_id = i.id
                AND inv.business_id = $1
            ), i.created_at) as last_restocked
          FROM items i
          LEFT JOIN item_categories ic ON i.category_id = ic.id
          WHERE i.business_id = $1
          ORDER BY i.name
          LIMIT 100
        `;
        const itemsResult = await client.query(itemsQuery, [businessId]);

        const items = itemsResult.rows.map((row: any) => {
          let status = 'in_stock';
          if (row.current_stock === 0) status = 'out_of_stock';
          else if (row.current_stock <= row.min_stock_level && row.min_stock_level > 0) status = 'low_stock';
          else if (row.current_stock >= row.max_stock_level && row.max_stock_level > 0) status = 'overstock';

          return {
            id: row.id,
            itemName: row.item_name,
            code: row.code || '',
            category: row.category || 'Uncategorized',
            currentStock: parseInt(row.current_stock || 0),
            minStockLevel: parseInt(row.min_stock_level || 0),
            maxStockLevel: parseInt(row.max_stock_level || 0),
            unitCost: parseFloat(row.unit_cost || 0),
            totalValue: parseFloat(row.total_value || 0),
            status,
            lastRestocked: row.last_restocked ? row.last_restocked.toISOString() : new Date().toISOString(),
            turnoverRate: parseFloat(row.turnover_rate || 0)
          };
        });

        // Calculate average turnover
        const avgTurnover = items.length > 0 
          ? items.reduce((sum, item) => sum + item.turnoverRate, 0) / items.length 
          : 0;

        const metrics = {
          totalItems: parseInt(inventoryData.total_items || 0),
          totalValue: parseFloat(inventoryData.total_value || 0),
          lowStockItems: parseInt(inventoryData.low_stock_items || 0),
          outOfStockItems: parseInt(inventoryData.out_of_stock_items || 0),
          overstockItems: parseInt(inventoryData.overstock_items || 0),
          averageTurnover: parseFloat(avgTurnover.toFixed(2)),
          items
        };

        res.json({ metrics });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error fetching inventory overview:', error);
      res.status(500).json({ error: 'Failed to fetch inventory overview' });
    }
  }
}