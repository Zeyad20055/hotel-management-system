import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLE_LIST } from './constants.js';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ROLE_LIST, required: true },
  active: { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: false },
  lastLoginAt: Date,
}, { timestamps: true });

userSchema.pre('save', async function hash(next) {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12);
  next();
});
userSchema.methods.comparePassword = function compare(plain) { return bcrypt.compare(plain, this.password); };
userSchema.set('toJSON', { transform: (_d, r) => { delete r.password; delete r.__v; return r; } });
export default mongoose.model('User', userSchema);
