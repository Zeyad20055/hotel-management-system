import { z } from 'zod';
import { ROLE_LIST, ROOM_TYPES, ROOM_STATUSES, HK_STATUSES, ID_TYPES } from '../models/constants.js';

export const oid = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const str = (max = 200) => z.string().trim().max(max);
const password = z.string().min(8, 'Password must be at least 8 characters').max(100)
  .regex(/[A-Za-z]/, 'Password must contain a letter').regex(/\d/, 'Password must contain a number');

export const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(100) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: password });

export const roomSchema = z.object({
  number: str(10).min(1, 'Room number is required'),
  type: z.enum(ROOM_TYPES),
  floor: z.coerce.number().int().min(0).max(200),
  capacity: z.coerce.number().int().min(1).max(20),
  beds: z.coerce.number().int().min(1).max(10),
  pricePerNight: z.coerce.number().min(0).max(1e7),
  description: str(1000).default(''),
  amenities: z.array(str(50).min(1)).max(30).default([]),
  image: z.union([z.string().url().max(500), z.literal('')]).default(''),
  status: z.enum(ROOM_STATUSES),
  housekeepingStatus: z.enum(HK_STATUSES),
});
export const roomCreate = roomSchema.partial({ status: true, housekeepingStatus: true });
export const roomPatch = roomSchema.partial();

const guestBase = z.object({
  fullName: str(120).min(2, 'Full name is required'),
  phone: str(30).min(5, 'Phone is required'),
  email: z.union([z.string().trim().email().max(120), z.literal('')]).default(''),
  nationality: str(60).default(''),
  idType: z.enum(ID_TYPES).default('national_id'),
  idNumber: z.union([str(40).min(3), z.literal('')]).optional(),
  address: str(300).default(''),
  dateOfBirth: z.union([day, z.literal('')]).optional(),
  notes: str(1000).default(''),
  active: z.boolean().optional(),
});
export const guestCreate = guestBase;
export const guestPatch = guestBase.partial();

export const reservationBody = z.object({
  guestId: oid.optional(),
  guest: guestBase.optional(),
  checkIn: day,
  checkOut: day,
  adults: z.coerce.number().int().min(1).max(20).default(1),
  children: z.coerce.number().int().min(0).max(20).default(0),
  roomIds: z.array(oid).min(1, 'Select at least one room').max(10),
  services: z.array(z.object({ serviceId: oid, quantity: z.coerce.number().int().min(1).max(100).default(1) })).max(30).default([]),
  discount: z.coerce.number().min(0).max(1e8).default(0),
  notes: str(1000).default(''),
  confirm: z.boolean().default(false),
});
export const reservationCreate = reservationBody.refine((b) => b.guestId || b.guest, { message: 'Select or register a guest', path: ['guestId'] });
export const reservationQuote = reservationBody.partial({ guestId: true, guest: true });
export const reservationPatch = reservationBody.omit({ guest: true, confirm: true, services: true }).partial();

export const checkInBody = z.object({
  deposit: z.object({ amount: z.coerce.number().positive(), method: str(40).min(1), idempotencyKey: str(100).optional(), notes: str(300).optional() }).optional(),
}).default({});
export const checkOutBody = z.object({ allowOutstanding: z.boolean().default(false), notes: str(300).optional() }).default({});
export const cancelBody = z.object({ reason: str(300).default('') }).default({});
export const chargeBody = z.object({ serviceId: oid, quantity: z.coerce.number().int().min(1).max(100).default(1) });

export const paymentCreate = z.object({
  reservationId: oid,
  amount: z.coerce.number().positive().max(1e9),
  method: str(40).min(1),
  status: z.enum(['completed', 'pending', 'failed']).default('completed'),
  kind: z.enum(['payment', 'deposit']).default('payment'),
  notes: str(300).default(''),
  transactionRef: str(100).default(''),
  idempotencyKey: str(100).optional(),
});
export const refundBody = z.object({ amount: z.coerce.number().positive(), reason: str(300).min(3, 'A reason is required') });

export const serviceSchema = z.object({ name: str(80).min(2), description: str(300).default(''), price: z.coerce.number().min(0).max(1e7), active: z.boolean().default(true) });
export const servicePatch = serviceSchema.partial();

export const taskCreate = z.object({ roomId: oid, type: z.enum(['cleaning', 'inspection']).default('cleaning'), assignedTo: oid.optional().nullable(), notes: str(500).default('') });
export const taskPatch = z.object({ status: z.enum(['pending', 'in_progress', 'needs_inspection', 'done']).optional(), assignedTo: oid.optional().nullable(), notes: str(500).optional() });
export const maintCreate = z.object({ roomId: oid, title: str(150).min(3), description: str(1000).default(''), priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'), blockRoom: z.boolean().default(true), assignedTo: oid.optional().nullable() });
export const maintPatch = z.object({ title: str(150).min(3).optional(), description: str(1000).optional(), priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(), status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional(), assignedTo: oid.optional().nullable(), notes: str(1000).optional() });

export const userCreate = z.object({ name: str(100).min(2), email: z.string().trim().email(), password, role: z.enum(ROLE_LIST) });
export const userPatch = z.object({ name: str(100).min(2).optional(), email: z.string().trim().email().optional(), role: z.enum(ROLE_LIST).optional(), active: z.boolean().optional(), password: password.optional() });

export const settingsSchema = z.object({
  hotelName: str(100).min(1), currency: z.string().trim().length(3), taxRate: z.coerce.number().min(0).max(100),
  timezone: str(60).refine((tz) => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } }, 'Invalid time zone'),
  maxReceptionistDiscountPercent: z.coerce.number().min(0).max(100),
  customPaymentMethods: z.array(str(40).min(1)).max(20),
}).partial();
