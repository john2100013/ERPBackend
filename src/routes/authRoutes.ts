import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/forgot-password', AuthController.requestPasswordReset);
router.post('/verify-otp', AuthController.verifyPasswordResetOTP);
router.post('/reset-password', AuthController.resetPassword);

// Protected routes
router.get('/profile', authenticateToken, AuthController.getProfile);
router.put('/password', authenticateToken, AuthController.updatePassword);
router.post('/logout', authenticateToken, AuthController.logout);

export default router;