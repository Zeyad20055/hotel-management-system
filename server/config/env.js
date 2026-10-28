import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(dir, '../../.env') });

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const env = {
  isProd,
  isTest,
  port: Number(process.env.PORT) || 5000,
  mongoUri: (process.env.MONGODB_URI || '').trim(),
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpires: process.env.JWT_EXPIRES_IN || '8h',
  clientOrigin: (process.env.CLIENT_ORIGIN || '').trim(),
  adminName: process.env.ADMIN_NAME || 'Hotel Administrator',
  adminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || '',
  seedDemo: process.env.SEED_DEMO === 'true',
};

const problems = [];
if (isProd) {
  if (env.jwtSecret.length < 32) problems.push('JWT_SECRET must be set to a random string of at least 32 characters.');
  if (!env.mongoUri) problems.push('MONGODB_URI is required in production (the in-memory database is development-only).');
  if (!env.adminEmail || env.adminPassword.length < 10) problems.push('ADMIN_EMAIL and ADMIN_PASSWORD (min 10 chars) are required in production to create the first Super Admin.');
}
if (problems.length) {
  console.error('\n[config] Invalid environment configuration:\n - ' + problems.join('\n - ') + '\n');
  process.exit(1);
}
if (!env.jwtSecret) {
  env.jwtSecret = crypto.randomBytes(32).toString('hex');
  if (!isTest) console.warn('[config] JWT_SECRET not set - using a temporary secret. Logins reset when the server restarts.');
}
export default env;
