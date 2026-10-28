import mongoose from 'mongoose';
const settingsSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  hotelName: { type: String, default: 'Grand Hotel' },
  currency: { type: String, default: 'EGP', uppercase: true, minlength: 3, maxlength: 3 },
  taxRate: { type: Number, default: 14, min: 0, max: 100 },
  timezone: { type: String, default: 'Africa/Cairo' },
  maxReceptionistDiscountPercent: { type: Number, default: 10, min: 0, max: 100 },
  customPaymentMethods: [{ type: String, trim: true }],
}, { timestamps: true });
export default mongoose.model('HotelSettings', settingsSchema);
