import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  type: { type: String, required: true },
  message: { type: String, required: true, maxlength: 240 },
  readAt: { type: Date, default: null, index: true }
}, { timestamps: true });

export default mongoose.model('Notification', notificationSchema);
