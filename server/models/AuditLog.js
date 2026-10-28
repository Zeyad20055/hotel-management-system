import mongoose from 'mongoose';
const auditSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  action: { type: String, required: true, index: true },
  entity: { type: String, required: true },
  entityId: { type: String },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false } });
auditSchema.index({ createdAt: -1 });
export default mongoose.model('AuditLog', auditSchema);
