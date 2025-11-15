import { Router } from 'express';
import { GoodsReturnController } from '../controllers/goodsReturnController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply middleware to all routes
router.use(authenticateToken);

// Goods return routes
router.get('/', GoodsReturnController.getReturns);
router.post('/', GoodsReturnController.createReturn);
router.get('/:id', GoodsReturnController.getReturnById);
router.put('/:id', GoodsReturnController.updateReturn);
router.put('/:id/process', GoodsReturnController.processReturn);
router.delete('/:id', GoodsReturnController.deleteReturn);

export default router;