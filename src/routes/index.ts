import { Router } from 'express';
import authRoutes from './authRoutes';
import itemRoutes from './itemRoutes';
import businessSettingsRoutes from './businessSettings';
import invoiceRoutes from './invoiceRoutes';
import quotationRoutes from './quotationRoutes';
import customerRoutes from './customerRoutes';
import financialAccountRoutes from './financialAccountRoutes';
import goodsReturnRoutes from './goodsReturnRoutes';
import damageRecordRoutes from './damageRecordRoutes';
import analyticsRoutes from './analyticsRoutes';
import serviceBillingRoutes from './serviceBillingRoutes';
import itemCategoryRoutes from './itemCategoryRoutes';
import salonRoutes from './salonRoutes';
import hospitalRoutes from './hospitalRoutes';
import mpesaRoutes from './mpesaRoutes';
import syncRoutes from './syncRoutes';
import userRoutes from './userRoutes';
import { getPool } from '../database/connection';

const router = Router();

// Mount route modules
router.use('/auth', authRoutes);
router.use('/items', itemRoutes);
router.use('/item-categories', itemCategoryRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/quotations', quotationRoutes);
router.use('/customers', customerRoutes);
router.use('/financial-accounts', financialAccountRoutes);
router.use('/goods-returns', goodsReturnRoutes);
router.use('/damage-records', damageRecordRoutes);
router.use('/analytics', analyticsRoutes(getPool()));
router.use('/service-billing', serviceBillingRoutes);
router.use('/salon', salonRoutes);
router.use('/hospital', hospitalRoutes);
router.use('/mpesa', mpesaRoutes);
router.use('/sync', syncRoutes);
router.use('/users', userRoutes);
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