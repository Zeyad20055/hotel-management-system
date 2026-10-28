import mongoose from 'mongoose';
import { ROOM_TYPES, ROOM_STATUSES, HK_STATUSES } from './constants.js';

const roomSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true, trim: true },
  type: { type: String, enum: ROOM_TYPES, required: true },
  floor: { type: Number, required: true, min: 0 },
  capacity: { type: Number, required: true, min: 1 },
  beds: { type: Number, required: true, min: 1 },
  pricePerNight: { type: Number, required: true, min: 0 },
  description: { type: String, default: '', maxlength: 1000 },
  amenities: [{ type: String, trim: true }],
  image: { type: String, default: '' },
  status: { type: String, enum: ROOM_STATUSES, default: 'available' },
  housekeepingStatus: { type: String, enum: HK_STATUSES, default: 'clean' },
}, { timestamps: true });
roomSchema.index({ type: 1, status: 1 });
roomSchema.index({ floor: 1 });
export default mongoose.model('Room', roomSchema);
