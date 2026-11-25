import { Router } from 'express';
import {
  changePassword,
  deleteAccount,
  getCurrentUser,
  loginDemoUser,
  loginUser,
  logoutUser,
  registerUser,
  updateProfile,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import {
  validateLoginPayload,
  validatePasswordChangePayload,
  validateProfilePayload,
  validateRegisterPayload,
} from '../middleware/validate.js';

const router = Router();

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 25,
  message: 'Too many authentication attempts. Please wait 15 minutes before retrying.',
});

router.post('/register', authRateLimiter, validateRegisterPayload, registerUser);
router.post('/login', authRateLimiter, validateLoginPayload, loginUser);
router.post('/demo', authRateLimiter, loginDemoUser);
router.post('/logout', requireAuth, logoutUser);
router.get('/me', requireAuth, getCurrentUser);
router.put('/profile', requireAuth, validateProfilePayload, updateProfile);
router.put('/password', requireAuth, validatePasswordChangePayload, changePassword);
router.delete('/account', requireAuth, deleteAccount);

export default router;
