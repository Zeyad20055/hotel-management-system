import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import env from './config/env.js';
import { dbState, dbInfo } from './config/db.js';
import { errorHandler, notFound } from './middlewares/common.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import roomRoutes from './routes/rooms.js';
import guestRoutes from './routes/guests.js';
import reservationRoutes from './routes/reservations.js';
import paymentRoutes from './routes/payments.js';
import serviceRoutes from './routes/services.js';
import settingsRoutes from './routes/settings.js';
import dashboardRoutes from './routes/dashboard.js';
import reportRoutes from './routes/reports.js';
import auditRoutes from './routes/audit.js';
import { housekeepingRouter, maintenanceRouter } from './routes/housekeeping.js';

const dir = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.isProd) app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: { directives: { ...helmet.contentSecurityPolicy.getDefaultDirectives(), 'img-src': ["'self'", 'data:', 'https:'] } } }));
  if (env.clientOrigin) app.use(cors({ origin: env.clientOrigin.split(','), credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(mongoSanitize());

  app.get('/api/health', (_req, res) => {
    const db = dbState();
    const healthy = db === 'connected';
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded', uptimeSeconds: Math.round(process.uptime()), environment: env.isProd ? 'production' : env.isTest ? 'test' : 'development',
      database: { state: db, mode: dbInfo.mode, persistent: dbInfo.mode === 'external' },
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/guests', guestRoutes);
  app.use('/api/reservations', reservationRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/services', serviceRoutes);
  app.use('/api/housekeeping', housekeepingRouter);
  app.use('/api/maintenance', maintenanceRouter);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api', notFound);

  const dist = path.resolve(dir, '../client/dist');
  if (env.isProd && fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use(errorHandler);
  return app;
}
