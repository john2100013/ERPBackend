import express from 'express';
import { authenticateToken } from '../middleware/auth';
import * as salonController from '../controllers/salonController';
import * as shiftController from '../controllers/salonShiftController';
import * as transactionController from '../controllers/salonTransactionController';
import * as analyticsController from '../controllers/salonAnalyticsController';

const router = express.Router();

// Salon Users
router.get('/users', authenticateToken, salonController.getSalonUsers);
router.get('/users/available', authenticateToken, salonController.getAvailableUsers);
router.post('/users', authenticateToken, salonController.createSalonUser);
router.put('/users/:id', authenticateToken, salonController.updateSalonUser);

// Services
router.get('/services', authenticateToken, salonController.getServices);
router.post('/services', authenticateToken, salonController.createService);
router.put('/services/:id', authenticateToken, salonController.updateService);

// Products
router.get('/products', authenticateToken, salonController.getProducts);
router.post('/products', authenticateToken, salonController.createProduct);
router.put('/products/:id', authenticateToken, salonController.updateProduct);
router.get('/products/low-stock', authenticateToken, salonController.getLowStockProducts);

// Shifts
router.post('/shifts/start', authenticateToken, shiftController.startShift);
router.get('/shifts/current', authenticateToken, shiftController.getCurrentShift);
router.post('/shifts/:id/close', authenticateToken, shiftController.closeShift);
router.get('/shifts', authenticateToken, shiftController.getShifts);
router.get('/shifts/:id', authenticateToken, shiftController.getShiftDetails);

// Transactions
router.post('/transactions', authenticateToken, transactionController.recordTransaction);
router.get('/transactions', authenticateToken, transactionController.getTransactions);
router.get('/transactions/:id', authenticateToken, transactionController.getTransactionDetails);

// Performance & Analytics
router.get('/performance/employees', authenticateToken, transactionController.getEmployeePerformance);
router.get('/dashboard/stats', authenticateToken, transactionController.getDashboardStats);

// Analytics
router.get('/analytics/invoices', authenticateToken, analyticsController.getInvoiceAnalytics);
router.get('/analytics/employees/services', authenticateToken, analyticsController.getEmployeeServiceAnalytics);
router.get('/analytics/products/sales', authenticateToken, analyticsController.getProductSalesAnalytics);
router.get('/analytics/services/sales', authenticateToken, analyticsController.getServiceSalesAnalytics);
router.get('/analytics/performers', authenticateToken, analyticsController.getBestWorstPerformers);
router.get('/analytics/low-stock', authenticateToken, analyticsController.getLowStockProducts);

export default router;
