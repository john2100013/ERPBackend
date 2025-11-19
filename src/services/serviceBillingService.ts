import { pool } from '../database/connection';

export class ServiceBillingService {
  // ==================== SERVICES ====================
  
  static async getServices(businessId: number) {
    const result = await pool.query(
      'SELECT * FROM services WHERE business_id = $1 AND is_active = true ORDER BY service_name ASC',
      [businessId]
    );
    return result.rows;
  }

  static async createService(businessId: number, data: {
    service_name: string;
    description?: string;
    price: number;
    estimated_duration: number;
  }) {
    const result = await pool.query(
      `INSERT INTO services (business_id, service_name, description, price, estimated_duration)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [businessId, data.service_name, data.description, data.price, data.estimated_duration]
    );
    return result.rows[0];
  }

  static async updateService(businessId: number, serviceId: number, data: any) {
    const result = await pool.query(
      `UPDATE services 
       SET service_name = COALESCE($1, service_name),
           description = COALESCE($2, description),
           price = COALESCE($3, price),
           estimated_duration = COALESCE($4, estimated_duration),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND business_id = $6
       RETURNING *`,
      [data.service_name, data.description, data.price, data.estimated_duration, serviceId, businessId]
    );
    return result.rows[0];
  }

  static async deleteService(businessId: number, serviceId: number) {
    const result = await pool.query(
      'UPDATE services SET is_active = false WHERE id = $1 AND business_id = $2',
      [serviceId, businessId]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  // ==================== CUSTOMERS ====================
  
  static async getCustomers(businessId: number) {
    const result = await pool.query(
      'SELECT * FROM service_customers WHERE business_id = $1 ORDER BY name ASC',
      [businessId]
    );
    return result.rows;
  }

  static async createCustomer(businessId: number, data: {
    name: string;
    phone: string;
    location?: string;
    email?: string;
    notes?: string;
  }) {
    const result = await pool.query(
      `INSERT INTO service_customers (business_id, name, phone, location, email, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [businessId, data.name, data.phone, data.location, data.email, data.notes]
    );
    return result.rows[0];
  }

  static async updateCustomer(businessId: number, customerId: number, data: any) {
    const result = await pool.query(
      `UPDATE service_customers 
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           location = COALESCE($3, location),
           email = COALESCE($4, email),
           notes = COALESCE($5, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND business_id = $7
       RETURNING *`,
      [data.name, data.phone, data.location, data.email, data.notes, customerId, businessId]
    );
    return result.rows[0];
  }

  // ==================== EMPLOYEES ====================
  
  static async getEmployees(businessId: number) {
    const result = await pool.query(
      'SELECT * FROM employees WHERE business_id = $1 AND is_active = true ORDER BY name ASC',
      [businessId]
    );
    return result.rows;
  }

  static async createEmployee(businessId: number, data: {
    name: string;
    phone?: string;
    email?: string;
    position?: string;
    commission_rate?: number;
  }) {
    const result = await pool.query(
      `INSERT INTO employees (business_id, name, phone, email, position, commission_rate)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [businessId, data.name, data.phone, data.email, data.position, data.commission_rate || 0]
    );
    return result.rows[0];
  }

  static async updateEmployee(businessId: number, employeeId: number, data: any) {
    const result = await pool.query(
      `UPDATE employees 
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           email = COALESCE($3, email),
           position = COALESCE($4, position),
           commission_rate = COALESCE($5, commission_rate),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND business_id = $7
       RETURNING *`,
      [data.name, data.phone, data.email, data.position, data.commission_rate, employeeId, businessId]
    );
    return result.rows[0];
  }

  // ==================== BOOKINGS ====================
  
  static async getBookings(businessId: number, params?: { status?: string; date?: string }) {
    let query = `
      SELECT b.*, 
             c.name as customer_name, c.phone as customer_phone,
             json_agg(json_build_object(
               'id', bs.id,
               'service_id', bs.service_id,
               'service_name', s.service_name,
               'employee_id', bs.employee_id,
               'employee_name', e.name,
               'start_time', bs.start_time,
               'end_time', bs.end_time,
               'estimated_duration', bs.estimated_duration,
               'status', bs.status
             )) as services
      FROM bookings b
      LEFT JOIN service_customers c ON b.customer_id = c.id
      LEFT JOIN booking_services bs ON b.id = bs.booking_id
      LEFT JOIN services s ON bs.service_id = s.id
      LEFT JOIN employees e ON bs.employee_id = e.id
      WHERE b.business_id = $1
    `;
    
    const queryParams: any[] = [businessId];
    let paramIndex = 2;

    if (params?.status) {
      query += ` AND b.status = $${paramIndex}`;
      queryParams.push(params.status);
      paramIndex++;
    }

    if (params?.date) {
      query += ` AND b.booking_date = $${paramIndex}`;
      queryParams.push(params.date);
      paramIndex++;
    }

    query += ` GROUP BY b.id, c.name, c.phone ORDER BY b.booking_date DESC, b.booking_time DESC`;

    const result = await pool.query(query, queryParams);
    return result.rows;
  }

  static async createBooking(businessId: number, data: {
    customer_id: number;
    booking_date: string;
    booking_time: string;
    services: Array<{ service_id: number; employee_id?: number }>;
    notes?: string;
  }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create booking
      const bookingResult = await client.query(
        `INSERT INTO bookings (business_id, customer_id, booking_date, booking_time, notes)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [businessId, data.customer_id, data.booking_date, data.booking_time, data.notes]
      );
      const booking = bookingResult.rows[0];

      // Add services to booking
      for (const service of data.services) {
        // Get service details for estimated duration
        const serviceData = await client.query(
          'SELECT estimated_duration FROM services WHERE id = $1',
          [service.service_id]
        );

        await client.query(
          `INSERT INTO booking_services (booking_id, service_id, employee_id, estimated_duration)
           VALUES ($1, $2, $3, $4)`,
          [booking.id, service.service_id, service.employee_id, serviceData.rows[0].estimated_duration]
        );
      }

      await client.query('COMMIT');
      return booking;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async assignEmployee(businessId: number, bookingServiceId: number, employeeId: number) {
    const result = await pool.query(
      `UPDATE booking_services 
       SET employee_id = $1, 
           start_time = CURRENT_TIMESTAMP,
           status = 'in_progress',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [employeeId, bookingServiceId]
    );
    return result.rows[0];
  }

  static async completeService(businessId: number, bookingServiceId: number) {
    const result = await pool.query(
      `UPDATE booking_services 
       SET end_time = CURRENT_TIMESTAMP,
           status = 'completed',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [bookingServiceId]
    );
    return result.rows[0];
  }

  // ==================== SERVICE INVOICES ====================
  
  static async createServiceInvoice(businessId: number, data: {
    customer_id: number;
    booking_id?: number;
    lines: Array<{
      service_id: number;
      employee_id?: number;
      service_name: string;
      duration: number;
      price: number;
    }>;
    payment_method?: string;
    notes?: string;
  }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Calculate totals
      const subtotal = data.lines.reduce((sum, line) => sum + line.price, 0);
      const vatAmount = subtotal * 0.16;
      const totalAmount = subtotal + vatAmount;

      // Generate invoice number
      const invoiceNumberResult = await client.query(
        `SELECT invoice_number FROM service_invoices 
         WHERE business_id = $1 
         ORDER BY id DESC LIMIT 1`,
        [businessId]
      );

      let nextNumber = 1;
      if (invoiceNumberResult.rows.length > 0) {
        const lastNumber = invoiceNumberResult.rows[0].invoice_number;
        if (lastNumber.startsWith('SRV-')) {
          nextNumber = parseInt(lastNumber.replace('SRV-', '')) + 1;
        }
      }
      const invoiceNumber = `SRV-${String(nextNumber).padStart(5, '0')}`;

      // Create invoice
      const invoiceResult = await client.query(
        `INSERT INTO service_invoices 
         (business_id, invoice_number, customer_id, booking_id, subtotal, vat_amount, total_amount, payment_status, payment_method, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'paid', $8, $9) RETURNING *`,
        [businessId, invoiceNumber, data.customer_id, data.booking_id, subtotal, vatAmount, totalAmount, data.payment_method, data.notes]
      );
      const invoice = invoiceResult.rows[0];

      // Create invoice lines
      for (const line of data.lines) {
        await client.query(
          `INSERT INTO service_invoice_lines 
           (invoice_id, service_id, employee_id, service_name, duration, price, amount)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [invoice.id, line.service_id, line.employee_id, line.service_name, line.duration, line.price, line.price]
        );
      }

      // Update booking status if booking_id provided
      if (data.booking_id) {
        await client.query(
          'UPDATE bookings SET status = $1 WHERE id = $2',
          ['completed', data.booking_id]
        );
      }

      await client.query('COMMIT');
      return invoice;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getServiceInvoices(businessId: number) {
    const result = await pool.query(
      `SELECT si.*, 
              c.name as customer_name, c.phone as customer_phone,
              json_agg(json_build_object(
                'id', sil.id,
                'service_name', sil.service_name,
                'employee_id', sil.employee_id,
                'duration', sil.duration,
                'price', sil.price,
                'amount', sil.amount
              )) as lines
       FROM service_invoices si
       LEFT JOIN service_customers c ON si.customer_id = c.id
       LEFT JOIN service_invoice_lines sil ON si.id = sil.invoice_id
       WHERE si.business_id = $1
       GROUP BY si.id, c.name, c.phone
       ORDER BY si.created_at DESC`,
      [businessId]
    );
    return result.rows;
  }

  // ==================== COMMISSION ====================
  
  static async getCommissionSettings(businessId: number) {
    const result = await pool.query(
      'SELECT * FROM commission_settings WHERE business_id = $1',
      [businessId]
    );
    return result.rows[0];
  }

  static async updateCommissionSettings(businessId: number, data: {
    min_customers: number;
    commission_rate: number;
  }) {
    const result = await pool.query(
      `INSERT INTO commission_settings (business_id, min_customers, commission_rate)
       VALUES ($1, $2, $3)
       ON CONFLICT (business_id) 
       DO UPDATE SET 
         min_customers = $2,
         commission_rate = $3,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [businessId, data.min_customers, data.commission_rate]
    );
    return result.rows[0];
  }

  static async calculateCommissions(businessId: number, periodStart: string, periodEnd: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get commission settings
      const settingsResult = await client.query(
        'SELECT * FROM commission_settings WHERE business_id = $1',
        [businessId]
      );

      if (settingsResult.rows.length === 0) {
        throw new Error('Commission settings not configured');
      }

      const settings = settingsResult.rows[0];

      // Get employee statistics
      const employeeStats = await client.query(
        `SELECT 
           sil.employee_id,
           e.name as employee_name,
           COUNT(DISTINCT si.customer_id) as total_customers,
           SUM(sil.amount) as total_revenue
         FROM service_invoice_lines sil
         JOIN service_invoices si ON sil.invoice_id = si.id
         JOIN employees e ON sil.employee_id = e.id
         WHERE si.business_id = $1 
           AND si.created_at >= $2 
           AND si.created_at <= $3
           AND sil.employee_id IS NOT NULL
         GROUP BY sil.employee_id, e.name`,
        [businessId, periodStart, periodEnd]
      );

      const commissions = [];

      for (const stat of employeeStats.rows) {
        if (stat.total_customers >= settings.min_customers) {
          const commissionAmount = (parseFloat(stat.total_revenue) * settings.commission_rate) / 100;

          const result = await client.query(
            `INSERT INTO employee_commissions 
             (business_id, employee_id, period_start, period_end, total_customers, total_revenue, commission_amount)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [businessId, stat.employee_id, periodStart, periodEnd, stat.total_customers, stat.total_revenue, commissionAmount]
          );

          commissions.push(result.rows[0]);
        }
      }

      await client.query('COMMIT');
      return commissions;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getEmployeeCommissions(businessId: number, employeeId?: number) {
    let query = `
      SELECT ec.*, e.name as employee_name
      FROM employee_commissions ec
      JOIN employees e ON ec.employee_id = e.id
      WHERE ec.business_id = $1
    `;
    
    const params: any[] = [businessId];

    if (employeeId) {
      query += ' AND ec.employee_id = $2';
      params.push(employeeId);
    }

    query += ' ORDER BY ec.created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  }

  // ==================== CUSTOMER ASSIGNMENTS ====================
  
  static async getAssignments(businessId: number, params?: { status?: string; employee_id?: number }) {
    let query = `
      SELECT ca.*, 
             c.name as customer_name, c.phone as customer_phone,
             e.name as employee_name,
             s.service_name, s.price as service_price,
             b.booking_date, b.booking_time
      FROM customer_assignments ca
      LEFT JOIN service_customers c ON ca.customer_id = c.id
      LEFT JOIN employees e ON ca.employee_id = e.id
      LEFT JOIN services s ON ca.service_id = s.id
      LEFT JOIN bookings b ON ca.booking_id = b.id
      WHERE ca.business_id = $1
    `;
    
    const queryParams: any[] = [businessId];
    let paramIndex = 2;

    if (params?.status) {
      query += ` AND ca.status = $${paramIndex}`;
      queryParams.push(params.status);
      paramIndex++;
    }

    if (params?.employee_id) {
      query += ` AND ca.employee_id = $${paramIndex}`;
      queryParams.push(params.employee_id);
      paramIndex++;
    }

    query += ` ORDER BY ca.created_at DESC`;

    const result = await pool.query(query, queryParams);
    return result.rows;
  }

  static async createAssignment(businessId: number, data: {
    customer_id: number;
    employee_id: number;
    service_id: number;
    booking_id?: number;
    notes?: string;
  }) {
    // Get service details for estimated duration
    const serviceData = await pool.query(
      'SELECT estimated_duration FROM services WHERE id = $1',
      [data.service_id]
    );

    const result = await pool.query(
      `INSERT INTO customer_assignments 
       (business_id, customer_id, employee_id, service_id, booking_id, estimated_duration, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [businessId, data.customer_id, data.employee_id, data.service_id, data.booking_id, 
       serviceData.rows[0].estimated_duration, data.notes]
    );
    return result.rows[0];
  }

  static async completeAssignment(businessId: number, assignmentId: number) {
    const result = await pool.query(
      `UPDATE customer_assignments 
       SET end_time = CURRENT_TIMESTAMP,
           status = 'completed',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND business_id = $2
       RETURNING *`,
      [assignmentId, businessId]
    );
    return result.rows[0];
  }

  static async getAssignmentsForBilling(businessId: number) {
    const result = await pool.query(
      `SELECT ca.*, 
              c.name as customer_name, c.phone as customer_phone,
              e.name as employee_name,
              s.service_name, s.price as service_price,
              EXTRACT(EPOCH FROM (COALESCE(ca.end_time, CURRENT_TIMESTAMP) - ca.start_time))/60 as actual_duration
       FROM customer_assignments ca
       LEFT JOIN service_customers c ON ca.customer_id = c.id
       LEFT JOIN employees e ON ca.employee_id = e.id
       LEFT JOIN services s ON ca.service_id = s.id
       WHERE ca.business_id = $1 AND ca.status != 'billed'
       ORDER BY ca.start_time DESC`,
      [businessId]
    );
    return result.rows;
  }

  static async createInvoiceFromAssignments(businessId: number, data: {
    customer_id: number;
    assignment_ids: number[];
    payment_method?: string;
    notes?: string;
  }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get assignment details
      const assignmentsResult = await client.query(
        `SELECT ca.*, s.service_name, s.price,
                EXTRACT(EPOCH FROM (COALESCE(ca.end_time, CURRENT_TIMESTAMP) - ca.start_time))/60 as actual_duration
         FROM customer_assignments ca
         JOIN services s ON ca.service_id = s.id
         WHERE ca.id = ANY($1) AND ca.business_id = $2 AND ca.status != 'billed'`,
        [data.assignment_ids, businessId]
      );

      const assignments = assignmentsResult.rows;
      
      if (assignments.length === 0) {
        throw new Error('No unbilled assignments found');
      }

      // Calculate totals
      const subtotal = assignments.reduce((sum, a) => sum + Number(a.price), 0);
      const vatAmount = subtotal * 0.16;
      const totalAmount = subtotal + vatAmount;

      // Generate invoice number
      const invoiceNumberResult = await client.query(
        `SELECT invoice_number FROM service_invoices 
         WHERE business_id = $1 
         ORDER BY id DESC LIMIT 1`,
        [businessId]
      );

      let nextNumber = 1;
      if (invoiceNumberResult.rows.length > 0) {
        const lastNumber = invoiceNumberResult.rows[0].invoice_number;
        if (lastNumber.startsWith('SRV-')) {
          nextNumber = parseInt(lastNumber.replace('SRV-', '')) + 1;
        }
      }
      const invoiceNumber = `SRV-${String(nextNumber).padStart(5, '0')}`;

      // Create invoice
      const invoiceResult = await client.query(
        `INSERT INTO service_invoices 
         (business_id, invoice_number, customer_id, subtotal, vat_amount, total_amount, payment_status, payment_method, notes)
         VALUES ($1, $2, $3, $4, $5, $6, 'paid', $7, $8) RETURNING *`,
        [businessId, invoiceNumber, data.customer_id, subtotal, vatAmount, totalAmount, 
         data.payment_method || 'Cash', data.notes]
      );
      const invoice = invoiceResult.rows[0];

      // Create invoice lines from assignments
      for (const assignment of assignments) {
        await client.query(
          `INSERT INTO service_invoice_lines 
           (invoice_id, service_id, employee_id, service_name, duration, price, amount)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [invoice.id, assignment.service_id, assignment.employee_id, assignment.service_name, 
           Math.round(assignment.actual_duration || assignment.estimated_duration), 
           assignment.price, assignment.price]
        );
      }

      // Mark assignments as billed
      await client.query(
        `UPDATE customer_assignments 
         SET status = 'billed', updated_at = CURRENT_TIMESTAMP
         WHERE id = ANY($1)`,
        [data.assignment_ids]
      );

      await client.query('COMMIT');
      return invoice;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
