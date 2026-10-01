import { Router } from 'express';
import Notification from '../models/Notification.js';
import { authenticate } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';

const router = Router();
router.use(authenticate);
router.get('/', async (req, res) => {
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ recipient: req.user._id }).populate('actor', 'name').sort({ createdAt: -1 }).limit(50).lean(),
    Notification.countDocuments({ recipient: req.user._id, readAt: null })
  ]);
  res.json({ notifications, unreadCount });
});
router.patch('/read-all', async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ ok: true });
});
router.patch('/:notificationId/read', async (req, res) => {
  const notification = await Notification.findOneAndUpdate({ _id: req.params.notificationId, recipient: req.user._id }, { $set: { readAt: new Date() } }, { new: true });
  if (!notification) throw new HttpError(404, 'Notification not found');
  res.json({ notification });
});
export default router;
