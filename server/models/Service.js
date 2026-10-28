import mongoose from 'mongoose';
const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });
export default mongoose.model('Service', serviceSchema);
