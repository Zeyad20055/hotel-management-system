// npm run seed  ->  seeds demo data into the database configured by MONGODB_URI.
import env from './config/env.js';
import { connectDB, disconnectDB, dbInfo } from './config/db.js';
import { ensureAdmin, seedDemo } from './bootstrap.js';

try {
  if (!env.mongoUri) {
    console.error('npm run seed needs MONGODB_URI (an in-memory database would be discarded immediately). Set it in .env. Note: `npm run dev` without MONGODB_URI already seeds its temporary database automatically.');
    process.exit(1);
  }
  await connectDB();
  await ensureAdmin();
  const done = await seedDemo({ force: process.argv.includes('--force') });
  console.log(done ? 'Seed complete.' : 'Nothing to do (rooms already exist). Pass --force to add demo data anyway.');
} catch (e) { console.error(e.message); process.exitCode = 1; } finally { await disconnectDB(); }
