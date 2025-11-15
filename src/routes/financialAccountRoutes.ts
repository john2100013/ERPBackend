import { Router } from 'express';
import { FinancialAccountController } from '../controllers/financialAccountController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply middleware to all routes
router.use(authenticateToken);

// Financial account routes
router.get('/', FinancialAccountController.getAccounts);
router.post('/', FinancialAccountController.createAccount);
router.get('/:id', FinancialAccountController.getAccountById);
router.put('/:id', FinancialAccountController.updateAccount);
router.delete('/:id', FinancialAccountController.deleteAccount);
router.get('/:id/balance', FinancialAccountController.getAccountBalance);

export default router;