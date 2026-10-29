import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  logger.error({ err, path: req.path }, 'Unhandled Request Error');
  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Validation failed', details: err.errors });
  }
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
}
