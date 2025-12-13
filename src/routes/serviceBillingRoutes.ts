import { Router } from 'express';
import { ServiceBillingController } from '../controllers/serviceBillingController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication middleware
router.use(authenticateToken);

// Services routes
router.get('/services', ServiceBillingController.getServices);
router.post('/services', ServiceBillingController.createService);
router.put('/services/:id', ServiceBillingController.updateService);
router.delete('/services/:id', ServiceBillingController.deleteService);

// Customers routes
router.get('/customers', ServiceBillingController.getCustomers);
router.post('/customers', ServiceBillingController.createCustomer);
router.put('/customers/:id', ServiceBillingController.updateCustomer);

// Employees routes
router.get('/employees', ServiceBillingController.getEmployees);
router.post('/employees', ServiceBillingController.createEmployee);
router.put('/employees/:id', ServiceBillingController.updateEmployee);

// Bookings routes
router.get('/bookings', ServiceBillingController.getBookings);
router.post('/bookings', ServiceBillingController.createBooking);
router.post('/bookings/services/:id/assign', ServiceBillingController.assignEmployee);
router.post('/bookings/services/:id/complete', ServiceBillingController.completeService);

// Invoice routes
router.post('/invoices', ServiceBillingController.createServiceInvoice);
router.get('/invoices', ServiceBillingController.getServiceInvoices);

// Commission routes
router.get('/commission/settings', ServiceBillingController.getCommissionSettings);
router.post('/commission/settings', ServiceBillingController.updateCommissionSettings);
router.post('/commission/calculate', ServiceBillingController.calculateCommissions);
router.get('/commission', ServiceBillingController.getEmployeeCommissions);

// Customer Assignments routes
router.get('/assignments', ServiceBillingController.getAssignments);
router.post('/assignments', ServiceBillingController.createAssignment);
router.post('/assignments/:id/complete', ServiceBillingController.completeAssignment);
router.get('/assignments/billing', ServiceBillingController.getAssignmentsForBilling);
router.post('/assignments/invoice', ServiceBillingController.createInvoiceFromAssignments);

// Analytics routes
router.get('/analytics/services', ServiceBillingController.getServiceAnalytics);
router.get('/analytics/employees', ServiceBillingController.getEmployeeAnalytics);
router.get('/analytics/products', ServiceBillingController.getProductAnalytics);
router.get('/analytics/performance', ServiceBillingController.getPerformanceAnalytics);
router.get('/analytics/returning-customers', ServiceBillingController.getReturningCustomers);

export default router;
