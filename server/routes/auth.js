import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import env from '../config/env.js';
import User from '../models/User.js';
import { protect, signToken, cookieOptions, COOKIE } from '../middlewares/auth.js';
import { validate } from '../middlewares/common.js';
import { loginSchema, changePasswordSchema } from '../validators/schemas.js';
import { asyncHandler, HttpError, ok } from '../utils/errors.js';
import { audit } from '../utils/audit.js';

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.isTest ? 1000 : 20, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many attempts, try again in a few minutes' } });

router.post('/login', limiter, validate(loginSchema), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+password');
  // same message for unknown user / wrong password / inactive to avoid account enumeration
  if (!user || !user.active || !(await user.comparePassword(req.body.password))) throw new HttpError(401, 'Invalid email or password');
  user.lastLoginAt = new Date();
  await user.save();
  res.cookie(COOKIE, signToken(user), cookieOptions());
  await audit(user, 'auth.login', 'User', user._id);
  ok(res, user.toJSON());
}));

router.post('/logout', asyncHandler(async (_req, res) => {
  res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
  ok(res, { loggedOut: true });
}));

router.get('/me', protect, (req, res) => ok(res, req.user.toJSON()));

router.post('/change-password', protect, limiter, validate(changePasswordSchema), asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.currentPassword))) throw new HttpError(400, 'Current password is incorrect');
  if (req.body.currentPassword === req.body.newPassword) throw new HttpError(400, 'The new password must be different');
  user.password = req.body.newPassword;
  user.mustChangePassword = false;
  await user.save();
  await audit(user, 'auth.change_password', 'User', user._id);
  res.cookie(COOKIE, signToken(user), cookieOptions());
  ok(res, user.toJSON());
}));
export default router;
