export class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

export function notFound(_req, _res, next) { next(new HttpError(404, 'Route not found')); }

export function errorHandler(err, _req, res, _next) {
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid request', details: err.message });
  }
  if (err.code === 11000) return res.status(409).json({ error: 'Email address is already registered' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  return res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message, details: err.details });
}
