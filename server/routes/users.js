import { Router } from 'express';
import User from '../models/User.js';
import { ROLES } from '../models/constants.js';
import { protect, authorize } from '../middlewares/auth.js';
import { validate, checkIdParam } from '../middlewares/common.js';
import { userCreate, userPatch } from '../validators/schemas.js';
import { asyncHandler, HttpError, ok } from '../utils/errors.js';
import { paginate, esc } from '../utils/helpers.js';
import { audit } from '../utils/audit.js';

const router = Router();
router.param('id', checkIdParam);
router.use(protect);

// Staff list is needed to assign tasks, so managers + reception can read it; only admins can write.
router.get('/', authorize(ROLES.SUPER, ROLES.ADMIN, ROLES.RECEPTION), asyncHandler(async (req, res) => {
  const f = {};
  if (req.query.role) f.role = String(req.query.role);
  if (req.query.active) f.active = req.query.active === 'true';
  if (req.query.search) { const r = new RegExp(esc(req.query.search), 'i'); f.$or = [{ name: r }, { email: r }]; }
  const { data, meta } = await paginate(User, f, req, { sortable: ['name', 'email', 'role', 'createdAt'], defaultSort: 'name' });
  ok(res, data, meta);
}));

const guardRole = (actor, role) => {
  if (role === ROLES.SUPER && actor.role !== ROLES.SUPER) throw new HttpError(403, 'Only a Super Admin can manage Super Admin accounts');
};

router.post('/', authorize(ROLES.SUPER, ROLES.ADMIN), validate(userCreate), asyncHandler(async (req, res) => {
  guardRole(req.user, req.body.role);
  const u = await User.create({ ...req.body, mustChangePassword: true });
  await audit(req.user, 'user.create', 'User', u._id, { email: u.email, role: u.role });
  ok(res, u.toJSON(), undefined, 201);
}));

router.patch('/:id', authorize(ROLES.SUPER, ROLES.ADMIN), validate(userPatch), asyncHandler(async (req, res) => {
  const u = await User.findById(req.params.id).select('+password');
  if (!u) throw new HttpError(404, 'User not found');
  guardRole(req.user, u.role); guardRole(req.user, req.body.role);
  if (String(u._id) === String(req.user._id) && (req.body.active === false || (req.body.role && req.body.role !== u.role))) throw new HttpError(409, 'You cannot deactivate or change the role of your own account');
  if (req.body.active === false || (req.body.role && req.body.role !== ROLES.SUPER && u.role === ROLES.SUPER)) {
    const supers = await User.countDocuments({ role: ROLES.SUPER, active: true, _id: { $ne: u._id } });
    if (u.role === ROLES.SUPER && supers === 0) throw new HttpError(409, 'At least one active Super Admin is required');
  }
  const { password, ...rest } = req.body;
  u.set(rest);
  if (password) { u.password = password; u.mustChangePassword = true; }
  await u.save();
  await audit(req.user, 'user.update', 'User', u._id, { fields: Object.keys(req.body).filter((k) => k !== 'password'), passwordReset: !!password });
  ok(res, u.toJSON());
}));
export default router;
