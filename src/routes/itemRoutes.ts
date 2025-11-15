import { Router } from 'express';
import { ItemController } from '../controllers/itemController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All item routes require authentication
router.use(authenticateToken);

// Item CRUD routes
router.post('/', ItemController.createItem);
router.get('/', ItemController.getItems);
router.get('/stats', ItemController.getItemStats);
router.get('/:id', ItemController.getItem);
router.put('/:id', ItemController.updateItem);
router.delete('/:id', ItemController.deleteItem);

export default router;