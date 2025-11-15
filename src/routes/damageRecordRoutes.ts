import { Router } from 'express';
import { DamageRecordController } from '../controllers/damageRecordController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply middleware to all routes
router.use(authenticateToken);

// Damage record routes
router.get('/', DamageRecordController.getDamageRecords);
router.post('/', DamageRecordController.createDamageRecord);
router.get('/:id', DamageRecordController.getDamageRecordById);
router.put('/:id', DamageRecordController.updateDamageRecord);
router.put('/:id/process', DamageRecordController.processDamageRecord);
router.delete('/:id', DamageRecordController.deleteDamageRecord);

export default router;