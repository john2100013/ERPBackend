import { Router } from 'express';
import authRoutes from './authRoutes';
import itemRoutes from './itemRoutes';
import businessSettingsRoutes from './businessSettings';
import invoiceRoutes from './invoiceRoutes';
import quotationRoutes from './quotationRoutes';
import financialAccountRoutes from './financialAccountRoutes';
import goodsReturnRoutes from './goodsReturnRoutes';
import damageRecordRoutes from './damageRecordRoutes';
import analyticsRoutes from './analyticsRoutes';
import { pool } from '../database/connection';

const router = Router();

// Mount route modules
router.use('/auth', authRoutes);
router.use('/items', itemRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/quotations', quotationRoutes);
router.use('/financial-accounts', financialAccountRoutes);
router.use('/goods-returns', goodsReturnRoutes);
router.use('/damage-records', damageRecordRoutes);
router.use('/analytics', analyticsRoutes(pool));
router.use('/', businessSettingsRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

export default router;