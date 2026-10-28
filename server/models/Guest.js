import mongoose from 'mongoose';
import { ID_TYPES } from './constants.js';

const guestSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true, default: '' },
  nationality: { type: String, trim: true, default: '' },
  idType: { type: String, enum: ID_TYPES, default: 'national_id' },
  idNumber: { type: String, trim: true },
  address: { type: String, default: '' },
  dateOfBirth: Date,
  notes: { type: String, default: '', maxlength: 1000 },
  active: { type: Boolean, default: true },
}, { timestamps: true });
guestSchema.index({ idType: 1, idNumber: 1 }, { unique: true, partialFilterExpression: { idNumber: { $type: 'string' } } });
guestSchema.index({ fullName: 1 });
guestSchema.index({ phone: 1 });
export default mongoose.model('Guest', guestSchema);
