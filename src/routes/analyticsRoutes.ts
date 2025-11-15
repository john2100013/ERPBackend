import express from 'express';
import { Pool } from 'pg';
import { AnalyticsController } from '../controllers/analyticsController';

const router = express.Router();

export default (pool: Pool) => {
  const analyticsController = new AnalyticsController(pool);

  // Overview Analytics - Main dashboard metrics
  router.get('/overview', async (req, res) => {
    await analyticsController.getOverview(req, res);
  });

  // Customer Insights
  router.get('/customer-insights', async (req, res) => {
    await analyticsController.getCustomerInsights(req, res);
  });

  // Revenue Trends
  router.get('/revenue-trends', async (req, res) => {
    await analyticsController.getRevenueTrends(req, res);
  });

  // Quotation Analysis
  router.get('/quotation-analysis', async (req, res) => {
    await analyticsController.getQuotationAnalysis(req, res);
  });

  // Stock Movement
  router.get('/stock-movement', async (req, res) => {
    await analyticsController.getStockMovement(req, res);
  });

  // Profitability Analysis
  router.get('/profitability-analysis', async (req, res) => {
    await analyticsController.getProfitabilityAnalysis(req, res);
  });

  // Pending Actions
  router.get('/pending-actions', async (req, res) => {
    await analyticsController.getPendingActions(req, res);
  });

  return router;
};