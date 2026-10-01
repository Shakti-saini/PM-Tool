import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { HttpError } from './errors.js';

export async function authenticate(req, _res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new HttpError(401, 'Authentication required');
    const { sub } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(sub).select('_id name email role');
    if (!user) throw new HttpError(401, 'Account no longer exists');
    req.user = user;
    next();
  } catch (err) { next(err.status ? err : new HttpError(401, 'Invalid or expired token')); }
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') return next(new HttpError(403, 'Administrator access required'));
  next();
}
