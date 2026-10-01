import { Router } from 'express';
import mongoose from 'mongoose';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { taskSchema, taskUpdateSchema, statusSchema } from '../schemas.js';
import { HttpError } from '../middleware/errors.js';
import { projectForMember } from '../services/projectAccess.js';
import { notifyAdmins, notifyUsers } from '../services/notifications.js';

const router = Router({ mergeParams: true });
router.use(authenticate);
const populate = [{ path: 'assignee createdBy', select: 'name email role' }, { path: 'comments.author', select: 'name email' }];
const isAdmin = req => req.user.role === 'admin';
const id = value => String(value?._id || value || '');
function emitTaskEvent(io, event, task, userIds = []) {
  const rooms = [...new Set(['admins', ...userIds.filter(Boolean).map(userId => `user:${id(userId)}`)])];
  io.to(rooms).emit(event, { task });
}
function isProjectMember(project, userId) {
  return project.members.some(member => id(member) === id(userId));
}

router.get('/', async (req, res) => {
  const project = await projectForMember(req.params.projectId, req.user);
  const filter = { project: project._id };
  if (!isAdmin(req)) filter.assignee = req.user._id;
  const tasks = await Task.find(filter).populate(populate).sort({ createdAt: -1 });
  res.json({ tasks });
});

router.post('/', validate(taskSchema), async (req, res) => {
  if (!isAdmin(req)) throw new HttpError(403, 'Only administrators can create tasks');
  const project = await projectForMember(req.params.projectId, req.user);
  const { assignee, ...data } = req.body;
  if (assignee && (!mongoose.isValidObjectId(assignee) || !project.members.some(member => id(member) === assignee))) throw new HttpError(400, 'Assignee must be assigned to this project');
  const task = await Task.create({ ...data, project: project._id, assignee: assignee || null, createdBy: req.user._id });
  await task.populate(populate);
  const io = req.app.get('io');
  emitTaskEvent(io, 'task:created', task, assignee ? [assignee] : []);
  if (assignee) await notifyUsers(io, [assignee], { actor: req.user._id, project: project._id, task: task._id, type: 'task-assigned', message: `You were assigned “${task.title}”.` });
  res.status(201).json({ task });
});

async function findTask(req) {
  const project = await projectForMember(req.params.projectId, req.user);
  const filter = { _id: req.params.taskId, project: project._id };
  if (!isAdmin(req)) filter.assignee = req.user._id;
  const task = await Task.findOne(filter).populate(populate);
  if (!task) throw new HttpError(404, 'Task not found');
  return { project, task };
}

async function announceUpdate(req, project, task, previous, previousAssignee) {
  const io = req.app.get('io');
  const event = task.status !== previous.status ? 'task:status-updated' : 'task:updated';
  const assigneeRooms = [id(previousAssignee), id(task.assignee)].filter(userId => userId && isProjectMember(project, userId));
  const rooms = [...new Set(['admins', ...assigneeRooms.map(userId => `user:${userId}`)])];
  io.to(rooms).emit(event, { task, previousStatus: previous.status, previousAssignee: id(previousAssignee), changedBy: { id: req.user.id, name: req.user.name } });
  const newAssignee = id(task.assignee);
  const recipients = new Set([newAssignee, id(previousAssignee)].filter(recipient => recipient && isProjectMember(project, recipient) && recipient !== String(req.user._id)));
  const changes = [];
  if (previousAssignee && id(previousAssignee) !== newAssignee) changes.push(`“${task.title}” was reassigned`);
  if (previous.status !== task.status) changes.push(`“${task.title}” status changed to ${task.status}`);
  if (previous.priority !== task.priority || String(previous.dueDate || '') !== String(task.dueDate || '')) changes.push(`“${task.title}” task details were updated`);
  if (previous.title !== task.title || previous.description !== task.description) changes.push(`“${task.title}” was updated`);
  if (changes.length && recipients.size) await notifyUsers(io, [...recipients], { actor: req.user._id, project: project._id, task: task._id, type: 'task-updated', message: changes[0] });
  if (!isAdmin(req) && (previous.status !== task.status || previous.priority !== task.priority || String(previous.dueDate || '') !== String(task.dueDate || ''))) {
    await notifyAdmins(io, req.user._id, { actor: req.user._id, project: project._id, task: task._id, type: task.status === 'done' ? 'task-completed' : 'task-updated', message: `${req.user.name} updated “${task.title}”${task.status === 'done' ? ' (completed)' : ''}.` });
  }
}

router.patch('/:taskId', validate(taskUpdateSchema), async (req, res) => {
  const { project, task } = await findTask(req);
  if (!isAdmin(req)) {
    if (Object.keys(req.body).some(key => key !== 'status')) throw new HttpError(403, 'Users can only change their assigned task status');
  }
  const previous = { status: task.status, priority: task.priority, dueDate: task.dueDate, title: task.title, description: task.description };
  const previousAssignee = task.assignee;
  const { assignee, ...data } = req.body;
  if (assignee !== undefined && assignee && (!mongoose.isValidObjectId(assignee) || !project.members.some(member => id(member) === assignee))) throw new HttpError(400, 'Assignee must be assigned to this project');
  Object.assign(task, data);
  if (assignee !== undefined) task.assignee = assignee;
  await task.save();
  await task.populate(populate);
  await announceUpdate(req, project, task, previous, previousAssignee);
  res.json({ task });
});

router.patch('/:taskId/status', validate(statusSchema), async (req, res) => {
  const { project, task } = await findTask(req);
  const previous = { status: task.status, priority: task.priority, dueDate: task.dueDate, title: task.title, description: task.description };
  const previousAssignee = task.assignee;
  task.status = req.body.status;
  await task.save();
  await task.populate(populate);
  await announceUpdate(req, project, task, previous, previousAssignee);
  res.json({ task });
});

router.post('/:taskId/comments', async (req, res) => {
  const { project, task } = await findTask(req);
  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  const attachments = Array.isArray(req.body.attachments) ? req.body.attachments : [];
  if (!body && !attachments.length) throw new HttpError(400, 'Write a comment or attach a file');
  if (body.length > 2000 || attachments.length > 3) throw new HttpError(400, 'Comment length or attachment count exceeded');
  const validAttachments = attachments.map(file => {
    if (!file?.name || !file?.data || file.data.length > 1500000) throw new HttpError(400, 'Each attachment must be smaller than 1 MB');
    const type = String(file.type || 'application/octet-stream').slice(0, 100);
    const allowedTypes = ['application/pdf', 'text/plain', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(type) || !String(file.data).startsWith(`data:${type};base64,`)) throw new HttpError(400, 'Attachment type is not supported');
    return { name: String(file.name).replace(/[\\/]/g, '_').slice(0, 160), type, data: file.data };
  });
  task.comments.push({ author: req.user._id, body: body || 'Shared an attachment', attachments: validAttachments });
  await task.save();
  await task.populate(populate);
  const comment = task.comments.at(-1);
  const io = req.app.get('io');
  const eventRooms = [...new Set(['admins', ...(task.assignee && isProjectMember(project, task.assignee) ? [`user:${id(task.assignee)}`] : [])])];
  io.to(eventRooms).emit('task:comment-added', { projectId: String(project._id), taskId: String(task._id), comment });
  const recipients = isAdmin(req) ? (task.assignee && isProjectMember(project, task.assignee) ? [task.assignee._id] : []) : await User.find({ role: 'admin' }).distinct('_id');
  await notifyUsers(io, recipients.filter(recipient => id(recipient) !== String(req.user._id)), { actor: req.user._id, project: project._id, task: task._id, type: 'task-comment', message: `${req.user.name} commented on “${task.title}”.` });
  res.status(201).json({ task, comment });
});

router.delete('/:taskId', async (req, res) => {
  if (!isAdmin(req)) throw new HttpError(403, 'Only administrators can delete tasks');
  const { project, task } = await findTask(req);
  await task.deleteOne();
  const rooms = [...new Set(['admins', ...(task.assignee && isProjectMember(project, task.assignee) ? [`user:${id(task.assignee)}`] : [])])];
  req.app.get('io').to(rooms).emit('task:deleted', { taskId: task._id.toString(), projectId: project._id.toString(), status: task.status });
  res.status(204).end();
});

export default router;
