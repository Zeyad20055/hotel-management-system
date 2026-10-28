import mongoose from 'mongoose';
import env from './config/env.js';
import { connectDB, disconnectDB, dbInfo } from './config/db.js';
import { createApp } from './app.js';
import { ensureAdmin, seedDemo } from './bootstrap.js';

async function main() {
  await connectDB();
  await mongoose.syncIndexes();
  await ensureAdmin();
  if (!env.isProd && (dbInfo.mode === 'memory' || env.seedDemo)) await seedDemo();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[server] API listening on http://localhost:${env.port}  (db: ${dbInfo.mode}${dbInfo.mode === 'memory' ? ' - TEMPORARY' : ''})`);
  });
  server.on('error', (e) => {
    console.error(e.code === 'EADDRINUSE' ? `[server] Port ${env.port} is already in use. Change PORT in .env or stop the other process.` : `[server] ${e.message}`);
    process.exit(1);
  });

  let closing = false;
  const shutdown = async (sig) => {
    if (closing) return; closing = true;
    console.log(`\n[server] ${sig} received, shutting down...`);
    server.close(async () => { try { await disconnectDB(); } finally { process.exit(0); } });
    setTimeout(() => process.exit(1), 8000).unref();
  };
  ['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => shutdown(s)));
}

main().catch((e) => { console.error(`\n[startup] ${e.message}\n`); process.exit(1); });
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
