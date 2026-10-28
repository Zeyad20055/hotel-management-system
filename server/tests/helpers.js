// Test harness: uses TEST_MONGODB_URI when provided (e.g. a local mongod), otherwise a throw-away in-memory MongoDB.
import supertest from 'supertest';

export async function boot(dbName) {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
  delete process.env.MONGODB_URI;
  if (process.env.TEST_MONGODB_URI) process.env.MONGODB_URI = `${process.env.TEST_MONGODB_URI.replace(/\/$/, '')}/${dbName}`;
  const { connectDB, disconnectDB } = await import('../config/db.js');
  const mongoose = (await import('mongoose')).default;
  await connectDB();
  await mongoose.connection.dropDatabase();
  await mongoose.syncIndexes();
  const { createApp } = await import('../app.js');
  const User = (await import('../models/User.js')).default;
  const app = createApp();
  const users = {};
  const defs = [['super_admin', 'super@t.io'], ['admin', 'admin@t.io'], ['receptionist', 'rec@t.io'], ['accountant', 'acc@t.io'], ['housekeeping', 'hk@t.io']];
  for (const [role, email] of defs) users[role] = await User.create({ name: `${role} user`, email, password: 'Passw0rd!x', role });
  const as = async (role) => {
    const agent = supertest.agent(app);
    const r = await agent.post('/api/auth/login').send({ email: users[role].email, password: 'Passw0rd!x' });
    if (r.status !== 200) throw new Error(`login failed for ${role}: ${r.status}`);
    return agent;
  };
  return { app, as, users, anon: () => supertest(app), shutdown: disconnectDB };
}
export const iso = (offset = 0) => {
  const d = new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
