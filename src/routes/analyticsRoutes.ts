import express from 'express';
import { Pool } from 'pg';
import { AnalyticsController } from '../controllers/analyticsController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

export default (pool: Pool) => {
  const analyticsController = new AnalyticsController(pool);

  // Overview Analytics - Main dashboard metrics
  router.get('/overview', authenticateToken, async (req: AuthenticatedRequest, res) => {
    await analyticsController.getOverview(req, res);
  });

  // Customer Insights
  router.get('/customer-insights', authenticateToken, async (req: AuthenticatedRequest, res) => {
    await analyticsController.getCustomerInsights(req, res);
  });

  // Revenue Trends
  router.get('/revenue-trends', authenticateToken, async (req: AuthenticatedRequest, res) => {
    await analyticsController.getRevenueTrends(req, res);
  });

  // Quotation Analysis
  router.get('/quotation-analysis', authenticateToken, async (req: AuthenticatedRequest, res) => {
    await analyticsController.getQuotationAnalysis(req, res);
  });

  // Stock Movement
  router.get('/stock-movement', authenticateToken, async (req: AuthenticatedRequest, res) => {
    await analyticsController.getStockMovement(req, res);
  });

  // Profitability Analysis
  router.get('/profitability-analysis', authenticateToken, async (req: AuthenticatedRequest, res) => {
    await analyticsController.getProfitabilityAnalysis(req, res);
  });

  // Pending Actions
  router.get('/pending-actions', authenticateToken, async (req: AuthenticatedRequest, res) => {
    await analyticsController.getPendingActions(req, res);
  });

  // Top Selling Items
  router.get('/top-selling-items', authenticateToken, async (req: AuthenticatedRequest, res) => {
    await analyticsController.getTopSellingItems(req, res);
  });

  // Sales Performance
  router.get('/sales-performance', authenticateToken, async (req: AuthenticatedRequest, res) => {
    await analyticsController.getSalesPerformance(req, res);
  });

  // Inventory Overview
  router.get('/inventory-overview', authenticateToken, async (req: AuthenticatedRequest, res) => {
    await analyticsController.getInventoryOverview(req, res);
  });

  // All Invoices with Products
  router.get('/all-invoices', authenticateToken, async (req: AuthenticatedRequest, res) => {
    await analyticsController.getAllInvoices(req, res);
  });

  // All Quotations with Products
  router.get('/all-quotations', authenticateToken, async (req: AuthenticatedRequest, res) => {
    await analyticsController.getAllQuotations(req, res);
  });

  return router;
};