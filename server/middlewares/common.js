import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { HttpError } from '../utils/errors.js';
import env from '../config/env.js';

export const validate = (schema, source = 'body') => (req, _res, next) => {
  const parsed = schema.safeParse(req[source]);
  if (!parsed.success) return next(parsed.error);
  Object.defineProperty(req, `valid_${source}`, { value: parsed.data, configurable: true });
  if (source === 'body') req.body = parsed.data;
  next();
};

export const checkIdParam = (req, _res, next, id) => {
  if (!mongoose.isValidObjectId(id)) return next(new HttpError(400, 'Invalid id'));
  next();
};

export const notFound = (req, _res, next) => next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return res.status(400).json({ success: false, message: details[0] ? `${details[0].field ? `${details[0].field}: ` : ''}${details[0].message}` : 'Validation failed', details });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ success: false, message: err.message, details: err.details });
  if (err?.name === 'ValidationError') return res.status(400).json({ success: false, message: Object.values(err.errors).map((e) => e.message).join('; ') });
  if (err?.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid value for ' + err.path });
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'value';
    return res.status(409).json({ success: false, message: `A record with this ${field} already exists`, details: { field } });
  }
  if (err?.type === 'entity.too.large') return res.status(413).json({ success: false, message: 'Request body too large' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'Malformed JSON body' });
  if (!env.isTest) console.error('[error]', req.method, req.originalUrl, err);
  return res.status(500).json({ success: false, message: 'Internal server error' });
}
