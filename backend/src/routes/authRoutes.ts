import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { authLimiter, registrationLimiter } from '../middleware/rateLimit';

const router = Router();

// Public routes
router.post('/register', registrationLimiter, authController.register);
router.post('/login', authLimiter, authController.login);

// Protected routes
router.get('/me', authenticate, authController.getCurrentUser);
router.get('/devices', authenticate, authController.getDevices);
router.post('/device/add', authenticate, authController.addDevice);
router.post('/device/revoke', authenticate, authController.revokeDevice);
router.post('/logout', authenticate, authController.logout);

export default router;
