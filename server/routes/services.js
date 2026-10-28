import { Router } from 'express';
import Service from '../models/Service.js';
import Reservation from '../models/Reservation.js';
import { ROLES } from '../models/constants.js';
import { protect, authorize } from '../middlewares/auth.js';
import { validate, checkIdParam } from '../middlewares/common.js';
import { serviceSchema, servicePatch } from '../validators/schemas.js';
import { asyncHandler, HttpError, ok } from '../utils/errors.js';
import { paginate, esc } from '../utils/helpers.js';
import { audit } from '../utils/audit.js';

const router = Router();
router.param('id', checkIdParam);
router.use(protect);
const manage = authorize(ROLES.SUPER, ROLES.ADMIN);

router.get('/', authorize(ROLES.SUPER, ROLES.ADMIN, ROLES.RECEPTION, ROLES.ACCOUNTANT), asyncHandler(async (req, res) => {
  const f = {};
  if (req.query.active) f.active = req.query.active === 'true';
  if (req.query.search) f.name = new RegExp(esc(req.query.search), 'i');
  const { data, meta } = await paginate(Service, f, req, { sortable: ['name', 'price'], defaultSort: 'name' });
  ok(res, data, meta);
}));
router.post('/', manage, validate(serviceSchema), asyncHandler(async (req, res) => {
  const s = await Service.create(req.body);
  await audit(req.user, 'service.create', 'Service', s._id, { name: s.name });
  ok(res, s, undefined, 201);
}));
router.patch('/:id', manage, validate(servicePatch), asyncHandler(async (req, res) => {
  const s = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!s) throw new HttpError(404, 'Service not found');
  await audit(req.user, 'service.update', 'Service', s._id, { fields: Object.keys(req.body) });
  ok(res, s);
}));
router.delete('/:id', manage, asyncHandler(async (req, res) => {
  const s = await Service.findById(req.params.id);
  if (!s) throw new HttpError(404, 'Service not found');
  if (await Reservation.exists({ 'charges.service': s._id })) {
    s.active = false; await s.save(); // keep billing history intact
    return ok(res, { deleted: false, deactivated: true });
  }
  await s.deleteOne();
  await audit(req.user, 'service.delete', 'Service', s._id, { name: s.name });
  ok(res, { deleted: true });
}));
export default router;
