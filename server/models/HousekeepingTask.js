import mongoose from 'mongoose';
const { Schema } = mongoose;
const taskSchema = new Schema({
  room: { type: Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  type: { type: String, enum: ['cleaning', 'inspection'], default: 'cleaning' },
  status: { type: String, enum: ['pending', 'in_progress', 'needs_inspection', 'done'], default: 'pending', index: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  reservation: { type: Schema.Types.ObjectId, ref: 'Reservation' },
  notes: { type: String, default: '' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  completedAt: Date,
}, { timestamps: true });
export default mongoose.model('HousekeepingTask', taskSchema);
