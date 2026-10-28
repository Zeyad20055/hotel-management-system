import mongoose from 'mongoose';
import { PAY_STATUSES } from './constants.js';
const { Schema } = mongoose;
const paymentSchema = new Schema({
  reference: { type: String, unique: true, required: true },
  reservation: { type: Schema.Types.ObjectId, ref: 'Reservation', required: true, index: true },
  guest: { type: Schema.Types.ObjectId, ref: 'Guest', required: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  method: { type: String, required: true },
  status: { type: String, enum: PAY_STATUSES, default: 'completed' },
  kind: { type: String, enum: ['payment', 'deposit'], default: 'payment' },
  paidAt: { type: Date, default: Date.now },
  transactionRef: { type: String, trim: true, default: '' }, // external reference (bank/terminal slip) - manual entry
  notes: { type: String, default: '' },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  idempotencyKey: { type: String },
  refundedAmount: { type: Number, default: 0 },
  refunds: [{ _id: false, amount: Number, reason: String, by: { type: Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now } }],
}, { timestamps: true });
paymentSchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
paymentSchema.index({ paidAt: -1 });
export default mongoose.model('Payment', paymentSchema);
