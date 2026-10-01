import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../schemas.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });
function session(user) {
  const token = jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });
  return { token, user: { id: user._id, name: user.name, email: user.email, role: user.role || 'user' } };
}

router.post('/register', authLimit, validate(registerSchema), async (req, res) => {
  const email = req.body.email.toLowerCase();
  if (await User.exists({ email })) throw new HttpError(409, 'Email address is already registered');
  const user = await User.create({ name: req.body.name, email, passwordHash: await bcrypt.hash(req.body.password, 12) });
  res.status(201).json(session(user));
});

router.post('/login', authLimit, validate(loginSchema), async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) throw new HttpError(401, 'Email or password is incorrect');
  res.json(session(user));
});

router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));
export default router;
