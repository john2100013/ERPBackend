import express from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  getSpacesAndTables,
  createSpace,
  createTable,
  saveOrder,
  getOpenOrders,
  getOrderDetails,
  billOrder,
} from '../controllers/restaurantController';

const router = express.Router();

// Spaces & tables
router.get('/spaces-and-tables', authenticateToken, getSpacesAndTables);
router.post('/spaces', authenticateToken, createSpace);
router.post('/tables', authenticateToken, createTable);

// Orders
router.get('/orders', authenticateToken, getOpenOrders);
router.get('/orders/:id', authenticateToken, getOrderDetails);
router.post('/orders/save', authenticateToken, saveOrder);
router.post('/orders/:id/bill', authenticateToken, billOrder);

export default router;


