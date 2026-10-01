import { Router } from 'express';
import User from '../models/User.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireAdmin);
router.get('/', async (_req, res) => {
  const users = await User.find().select('_id name email role createdAt').sort({ name: 1 }).lean();
  res.json({ users });
});
export default router;
