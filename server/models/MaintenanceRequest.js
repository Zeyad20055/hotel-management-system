import mongoose from 'mongoose';
const { Schema } = mongoose;
const maintSchema = new Schema({
  room: { type: Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, default: '' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  status: { type: String, enum: ['open', 'in_progress', 'completed', 'cancelled'], default: 'open', index: true },
  blockRoom: { type: Boolean, default: true }, // takes the room out of the bookable inventory while the request is open
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, default: '' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  completedAt: Date,
}, { timestamps: true });
export default mongoose.model('MaintenanceRequest', maintSchema);
