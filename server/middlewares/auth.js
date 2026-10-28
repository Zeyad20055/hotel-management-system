import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import User from '../models/User.js';
import { HttpError, asyncHandler } from '../utils/errors.js';

export const COOKIE = 'hms_token';
export const cookieOptions = () => ({ httpOnly: true, sameSite: 'lax', secure: env.isProd, maxAge: 8 * 3600 * 1000, path: '/' });
export const signToken = (user) => jwt.sign({ sub: String(user._id) }, env.jwtSecret, { expiresIn: env.jwtExpires });

export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = req.cookies?.[COOKIE] || (header?.startsWith('Bearer ') ? header.slice(7) : null);
  if (!token) throw new HttpError(401, 'Authentication required');
  let payload;
  try { payload = jwt.verify(token, env.jwtSecret); } catch { throw new HttpError(401, 'Session expired, please sign in again'); }
  const user = await User.findById(payload.sub);
  if (!user || !user.active) throw new HttpError(401, 'Account not found or deactivated');
  if (user.mustChangePassword && !req.originalUrl.startsWith('/api/auth')) {
    throw new HttpError(403, 'You must change your password before continuing', { code: 'PASSWORD_CHANGE_REQUIRED' });
  }
  req.user = user;
  next();
});

export const authorize = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have permission to perform this action'));
  next();
};
