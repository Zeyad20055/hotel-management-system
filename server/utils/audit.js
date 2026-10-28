import AuditLog from '../models/AuditLog.js';
export async function audit(user, action, entity, entityId, meta = {}) {
  try {
    await AuditLog.create({ user: user?._id, userName: user?.name, action, entity, entityId, meta });
  } catch (e) { console.error('[audit] failed:', e.message); }
}
