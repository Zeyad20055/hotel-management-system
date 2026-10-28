import { Router } from 'express';
import { ROLES } from '../models/constants.js';
import { protect, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/common.js';
import { settingsSchema } from '../validators/schemas.js';
import { asyncHandler, ok } from '../utils/errors.js';
import { getSettings, paymentMethods } from '../services/settingsService.js';
import { todayStr } from '../utils/helpers.js';
import { audit } from '../utils/audit.js';

const router = Router();
router.use(protect);
router.get('/', asyncHandler(async (_req, res) => { const s = await getSettings(); ok(res, { ...s.toObject(), paymentMethods: paymentMethods(s), today: todayStr(s.timezone) }); }));
router.put('/', authorize(ROLES.SUPER, ROLES.ADMIN), validate(settingsSchema), asyncHandler(async (req, res) => {
  const s = await getSettings();
  s.set(req.body); await s.save();
  await audit(req.user, 'settings.update', 'HotelSettings', s._id, req.body);
  ok(res, { ...s.toObject(), paymentMethods: paymentMethods(s), today: todayStr(s.timezone) });
}));
export default router;
