import { Request, Response, NextFunction } from 'express';
import { ServiceBillingService } from '../services/serviceBillingService';

export class ServiceBillingController {
  // ==================== SERVICES ====================
  
  static async getServices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const services = await ServiceBillingService.getServices(businessId);

      res.json({
        success: true,
        data: { services }
      });
    } catch (error) {
      next(error);
    }
  }

  static async createService(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { service_name, description, price, estimated_duration } = req.body;

      if (!service_name || !price || !estimated_duration) {
        res.status(400).json({
          success: false,
          message: 'Service name, price, and estimated duration are required'
        });
        return;
      }

      const service = await ServiceBillingService.createService(businessId, {
        service_name,
        description,
        price: parseFloat(price),
        estimated_duration: parseInt(estimated_duration)
      });

      res.status(201).json({
        success: true,
        message: 'Service created successfully',
        data: { service }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateService(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const serviceId = parseInt(req.params.id);
      const service = await ServiceBillingService.updateService(businessId, serviceId, req.body);

      if (!service) {
        res.status(404).json({
          success: false,
          message: 'Service not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Service updated successfully',
        data: { service }
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteService(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const serviceId = parseInt(req.params.id);
      await ServiceBillingService.deleteService(businessId, serviceId);

      res.json({
        success: true,
        message: 'Service deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== CUSTOMERS ====================
  
  static async getCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const customers = await ServiceBillingService.getCustomers(businessId);

      res.json({
        success: true,
        data: { customers }
      });
    } catch (error) {
      next(error);
    }
  }

  static async createCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { name, phone, location, email, notes } = req.body;

      if (!name || !phone) {
        res.status(400).json({
          success: false,
          message: 'Name and phone are required'
        });
        return;
      }

      const customer = await ServiceBillingService.createCustomer(businessId, {
        name,
        phone,
        location,
        email,
        notes
      });

      res.status(201).json({
        success: true,
        message: 'Customer created successfully',
        data: { customer }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const customerId = parseInt(req.params.id);
      const customer = await ServiceBillingService.updateCustomer(businessId, customerId, req.body);

      if (!customer) {
        res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Customer updated successfully',
        data: { customer }
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== EMPLOYEES ====================
  
  static async getEmployees(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const employees = await ServiceBillingService.getEmployees(businessId);

      res.json({
        success: true,
        data: { employees }
      });
    } catch (error) {
      next(error);
    }
  }

  static async createEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { name, phone, email, position, commission_rate } = req.body;

      if (!name) {
        res.status(400).json({
          success: false,
          message: 'Name is required'
        });
        return;
      }

      const employee = await ServiceBillingService.createEmployee(businessId, {
        name,
        phone,
        email,
        position,
        commission_rate: commission_rate ? parseFloat(commission_rate) : 0
      });

      res.status(201).json({
        success: true,
        message: 'Employee created successfully',
        data: { employee }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const employeeId = parseInt(req.params.id);
      const employee = await ServiceBillingService.updateEmployee(businessId, employeeId, req.body);

      if (!employee) {
        res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Employee updated successfully',
        data: { employee }
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== BOOKINGS ====================
  
  static async getBookings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { status, date } = req.query;
      
      const bookings = await ServiceBillingService.getBookings(businessId, {
        status: status as string,
        date: date as string
      });

      res.json({
        success: true,
        data: { bookings }
      });
    } catch (error) {
      next(error);
    }
  }

  static async createBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { customer_id, booking_date, booking_time, services, notes } = req.body;

      if (!customer_id || !booking_date || !booking_time || !services || services.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Customer, date, time, and at least one service are required'
        });
        return;
      }

      const booking = await ServiceBillingService.createBooking(businessId, {
        customer_id: parseInt(customer_id),
        booking_date,
        booking_time,
        services,
        notes
      });

      res.status(201).json({
        success: true,
        message: 'Booking created successfully',
        data: { booking }
      });
    } catch (error) {
      next(error);
    }
  }

  static async assignEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const bookingServiceId = parseInt(req.params.id);
      const { employee_id } = req.body;

      if (!employee_id) {
        res.status(400).json({
          success: false,
          message: 'Employee ID is required'
        });
        return;
      }

      const bookingService = await ServiceBillingService.assignEmployee(businessId, bookingServiceId, parseInt(employee_id));

      res.json({
        success: true,
        message: 'Employee assigned successfully',
        data: { bookingService }
      });
    } catch (error) {
      next(error);
    }
  }

  static async completeService(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const bookingServiceId = parseInt(req.params.id);

      const bookingService = await ServiceBillingService.completeService(businessId, bookingServiceId);

      res.json({
        success: true,
        message: 'Service marked as completed',
        data: { bookingService }
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== SERVICE INVOICES ====================
  
  static async createServiceInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { customer_id, booking_id, lines, payment_method, notes } = req.body;

      if (!customer_id || !lines || lines.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Customer and at least one service line are required'
        });
        return;
      }

      const invoice = await ServiceBillingService.createServiceInvoice(businessId, {
        customer_id: parseInt(customer_id),
        booking_id: booking_id ? parseInt(booking_id) : undefined,
        lines,
        payment_method,
        notes
      });

      res.status(201).json({
        success: true,
        message: 'Service invoice created successfully',
        data: { invoice }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getServiceInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const invoices = await ServiceBillingService.getServiceInvoices(businessId);

      res.json({
        success: true,
        data: { invoices }
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== COMMISSION ====================
  
  static async getCommissionSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const settings = await ServiceBillingService.getCommissionSettings(businessId);

      res.json({
        success: true,
        data: { settings }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateCommissionSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { min_customers, commission_rate } = req.body;

      if (!min_customers || !commission_rate) {
        res.status(400).json({
          success: false,
          message: 'Minimum customers and commission rate are required'
        });
        return;
      }

      const settings = await ServiceBillingService.updateCommissionSettings(businessId, {
        min_customers: parseInt(min_customers),
        commission_rate: parseFloat(commission_rate)
      });

      res.json({
        success: true,
        message: 'Commission settings updated successfully',
        data: { settings }
      });
    } catch (error) {
      next(error);
    }
  }

  static async calculateCommissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { period_start, period_end } = req.body;

      if (!period_start || !period_end) {
        res.status(400).json({
          success: false,
          message: 'Period start and end dates are required'
        });
        return;
      }

      const commissions = await ServiceBillingService.calculateCommissions(businessId, period_start, period_end);

      res.json({
        success: true,
        message: 'Commissions calculated successfully',
        data: { commissions }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getEmployeeCommissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const employeeId = req.query.employee_id ? parseInt(req.query.employee_id as string) : undefined;
      
      const commissions = await ServiceBillingService.getEmployeeCommissions(businessId, employeeId);

      res.json({
        success: true,
        data: { commissions }
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== CUSTOMER ASSIGNMENTS ====================
  
  static async getAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { status, employee_id } = req.query;
      
      const assignments = await ServiceBillingService.getAssignments(businessId, {
        status: status as string,
        employee_id: employee_id ? parseInt(employee_id as string) : undefined
      });

      res.json({
        success: true,
        data: { assignments }
      });
    } catch (error) {
      next(error);
    }
  }

  static async createAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { customer_id, employee_id, service_id, booking_id, notes } = req.body;

      if (!customer_id || !employee_id || !service_id) {
        res.status(400).json({
          success: false,
          message: 'Customer, employee, and service are required'
        });
        return;
      }

      const assignment = await ServiceBillingService.createAssignment(businessId, {
        customer_id: parseInt(customer_id),
        employee_id: parseInt(employee_id),
        service_id: parseInt(service_id),
        booking_id: booking_id ? parseInt(booking_id) : undefined,
        notes
      });

      res.status(201).json({
        success: true,
        message: 'Customer assigned to employee successfully',
        data: { assignment }
      });
    } catch (error) {
      next(error);
    }
  }

  static async completeAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { id } = req.params;

      const assignment = await ServiceBillingService.completeAssignment(businessId, parseInt(id));

      res.json({
        success: true,
        message: 'Assignment completed successfully',
        data: { assignment }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAssignmentsForBilling(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      
      if (!businessId) {
        console.error('❌ [ServiceBillingController] getAssignmentsForBilling: businessId is missing');
        res.status(400).json({
          success: false,
          message: 'Business ID is required'
        });
        return;
      }
      
      console.log('📋 [ServiceBillingController] getAssignmentsForBilling: businessId =', businessId);
      const assignments = await ServiceBillingService.getAssignmentsForBilling(businessId);
      console.log('✅ [ServiceBillingController] getAssignmentsForBilling: found', assignments.length, 'assignments');

      res.json({
        success: true,
        data: { assignments }
      });
    } catch (error: any) {
      console.error('❌ [ServiceBillingController] getAssignmentsForBilling error:', error);
      next(error);
    }
  }

  static async createInvoiceFromAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { customer_id, assignment_ids, payment_method, notes } = req.body;

      if (!customer_id || !assignment_ids || assignment_ids.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Customer ID and at least one assignment are required'
        });
        return;
      }

      const invoice = await ServiceBillingService.createInvoiceFromAssignments(businessId, {
        customer_id: parseInt(customer_id),
        assignment_ids: assignment_ids.map((id: any) => parseInt(id)),
        payment_method,
        notes
      });

      res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        data: { invoice }
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================== ANALYTICS ====================

  static async getServiceAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { startDate, endDate } = req.query;

      const analytics = await ServiceBillingService.getServiceAnalytics(
        businessId,
        startDate as string | undefined,
        endDate as string | undefined
      );

      res.json({
        success: true,
        data: { analytics }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getEmployeeAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { startDate, endDate } = req.query;

      const analytics = await ServiceBillingService.getEmployeeAnalytics(
        businessId,
        startDate as string | undefined,
        endDate as string | undefined
      );

      res.json({
        success: true,
        data: { analytics }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getProductAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { startDate, endDate } = req.query;

      const analytics = await ServiceBillingService.getProductAnalytics(
        businessId,
        startDate as string | undefined,
        endDate as string | undefined
      );

      res.json({
        success: true,
        data: { analytics }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPerformanceAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { startDate, endDate } = req.query;

      const analytics = await ServiceBillingService.getPerformanceAnalytics(
        businessId,
        startDate as string | undefined,
        endDate as string | undefined
      );

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  }

  static async getReturningCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = (req as any).businessId;
      const { startDate, endDate } = req.query;

      const customers = await ServiceBillingService.getReturningCustomers(
        businessId,
        startDate as string | undefined,
        endDate as string | undefined
      );

      res.json({
        success: true,
        data: { customers }
      });
    } catch (error) {
      next(error);
    }
  }
}
