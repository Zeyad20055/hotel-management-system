import HotelSettings from '../models/HotelSettings.js';
import { BASE_METHODS } from '../models/constants.js';

export async function getSettings() {
  return HotelSettings.findOneAndUpdate({ key: 'main' }, { $setOnInsert: { key: 'main' } }, { upsert: true, new: true, setDefaultsOnInsert: true });
}
export const paymentMethods = (s) => [...BASE_METHODS, ...(s.customPaymentMethods || []).map((m) => m.toLowerCase().replace(/\s+/g, '_'))];
