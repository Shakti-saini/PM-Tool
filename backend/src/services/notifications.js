import Notification from '../models/Notification.js';

export async function notifyUsers(io, userIds, details) {
  const ids = [...new Set(userIds.map(id => String(id)).filter(Boolean))];
  if (!ids.length) return;
  const records = await Notification.insertMany(ids.map(recipient => ({ recipient, ...details })));
  for (const notification of records) io.to(`user:${notification.recipient}`).emit('notification:new', { notification });
}

export async function notifyAdmins(io, actorId, details) {
  const User = (await import('../models/User.js')).default;
  const admins = await User.find({ role: 'admin', _id: { $ne: actorId } }).select('_id').lean();
  await notifyUsers(io, admins.map(admin => admin._id), details);
}
