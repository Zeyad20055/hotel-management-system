import { Router } from 'express';
import AuditLog from '../models/AuditLog.js';
import { ROLES } from '../models/constants.js';
import { protect, authorize } from '../middlewares/auth.js';
import { asyncHandler, ok } from '../utils/errors.js';
import { paginate, esc } from '../utils/helpers.js';

const router = Router();
router.use(protect);
// Reception may read the check-in/out history; everything else is admin-only.
router.get('/', authorize(ROLES.SUPER, ROLES.ADMIN, ROLES.RECEPTION), asyncHandler(async (req, res) => {
  const f = {};
  const restricted = req.user.role === ROLES.RECEPTION;
  if (req.query.action) f.action = { $in: String(req.query.action).split(',') };
  if (restricted) f.action = { $in: ['reservation.check_in', 'reservation.check_out'] };
  if (req.query.search) f.userName = new RegExp(esc(req.query.search), 'i');
  const { data, meta } = await paginate(AuditLog, f, req, { sortable: ['createdAt'], defaultSort: '-createdAt' });
  ok(res, data, meta);
}));
export default router;
