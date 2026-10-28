import mongoose from 'mongoose';
import { RES_STATUSES } from './constants.js';
const { Schema } = mongoose;

// Booking charges (ReservationService equivalent) are embedded: they snapshot name/price at the time of sale.
const chargeSchema = new Schema({
  service: { type: Schema.Types.ObjectId, ref: 'Service' },
  name: String,
  quantity: { type: Number, min: 1 },
  unitPrice: Number,
  total: Number,
  addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  addedAt: { type: Date, default: Date.now },
});

const reservationSchema = new Schema({
  reference: { type: String, unique: true, required: true },
  guest: { type: Schema.Types.ObjectId, ref: 'Guest', required: true, index: true },
  rooms: [{ _id: false, room: { type: Schema.Types.ObjectId, ref: 'Room', required: true }, rate: { type: Number, required: true, min: 0 } }],
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  nights: Number,
  adults: { type: Number, default: 1, min: 1 },
  children: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: RES_STATUSES, default: 'pending' },
  charges: [chargeSchema],
  roomTotal: { type: Number, default: 0 },
  servicesTotal: { type: Number, default: 0 },
  subtotal: { type: Number, default: 0 },
  discount: { type: Number, default: 0, min: 0 },
  discountBy: { type: Schema.Types.ObjectId, ref: 'User' },
  taxRate: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  paid: { type: Number, default: 0 }, // net collected (payments - refunds); maintained by paymentService.refreshPaid
  notes: { type: String, default: '' },
  cancelReason: String,
  cancelledAt: Date,
  checkedInAt: Date,
  checkedOutAt: Date,
  checkedInBy: { type: Schema.Types.ObjectId, ref: 'User' },
  checkedOutBy: { type: Schema.Types.ObjectId, ref: 'User' },
  outstandingAtCheckout: Number,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
reservationSchema.index({ status: 1, checkIn: 1, checkOut: 1 });
reservationSchema.index({ 'rooms.room': 1, status: 1 });
reservationSchema.index({ createdAt: -1 });
export default mongoose.model('Reservation', reservationSchema);
