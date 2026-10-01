import { Router } from 'express';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { projectSchema, projectUpdateSchema } from '../schemas.js';
import { HttpError } from '../middleware/errors.js';
import { projectForMember } from '../services/projectAccess.js';
import { notifyUsers } from '../services/notifications.js';

const router = Router();
router.use(authenticate);
const membersFields = 'name email role';

router.get('/', async (req, res) => {
  const projects = await Project.find(req.user.role === 'admin' ? {} : { members: req.user._id }).populate('members', membersFields).populate('owner', 'name email').sort({ updatedAt: -1 }).lean();
  const ids = projects.map(p => p._id);
  const taskFilter = { project: { $in: ids } };
  if (req.user.role !== 'admin') taskFilter.assignee = req.user._id;
  const counts = await Task.aggregate([{ $match: taskFilter }, { $group: { _id: '$project', total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } } } }]);
  const byProject = new Map(counts.map(c => [c._id.toString(), c]));
  res.json({ projects: projects.map(p => ({ ...p, taskCount: byProject.get(p._id.toString())?.total || 0, completedCount: byProject.get(p._id.toString())?.done || 0 })) });
});

router.post('/', requireAdmin, validate(projectSchema), async (req, res) => {
  const assigned = [...new Set((req.body.members || []).map(String))];
  const users = await User.find({ _id: { $in: assigned } }).select('_id');
  if (users.length !== assigned.length) throw new HttpError(400, 'All assigned users must exist');
  const project = await Project.create({ ...req.body, owner: req.user._id, members: [...new Set([req.user._id.toString(), ...assigned])] });
  await project.populate('members', membersFields);
  await project.populate('owner', 'name email');
  const io = req.app.get('io');
  for (const member of project.members) io.to(`user:${member._id}`).emit('project:created', { project });
  await notifyUsers(io, assigned, { actor: req.user._id, project: project._id, type: 'project-assigned', message: `You were assigned to project “${project.name}”.` });
  res.status(201).json({ project });
});

router.get('/:projectId', async (req, res) => {
  const project = await projectForMember(req.params.projectId, req.user);
  if (req.user.role !== 'admin' && !project.members.some(id => id.toString() === req.user._id.toString())) throw new HttpError(404, 'Project not found');
  await project.populate('members', membersFields);
  await project.populate('owner', 'name email');
  res.json({ project });
});

router.patch('/:projectId', requireAdmin, validate(projectUpdateSchema), async (req, res) => {
  const project = await projectForMember(req.params.projectId, req.user);
  const previousMembers = project.members.map(String);
  const { members, ...fields } = req.body;
  Object.assign(project, fields);
  const startDate = fields.startDate === undefined ? project.startDate : new Date(fields.startDate);
  const dueDate = fields.dueDate === undefined ? project.dueDate : new Date(fields.dueDate);
  if (startDate && dueDate && dueDate < startDate) throw new HttpError(400, 'Project deadline must be on or after its start date');
  if (members) {
    const assigned = [...new Set([project.owner.toString(), ...members.map(String)])];
    const users = await User.find({ _id: { $in: assigned } }).select('_id');
    if (users.length !== assigned.length) throw new HttpError(400, 'All assigned users must exist');
    project.members = assigned;
  }
  await project.save();
  await project.populate('members', membersFields);
  const io = req.app.get('io');
  io.to(project._id.toString()).emit('project:updated', { project });
  const currentMembers = project.members.map(member => String(member._id));
  for (const memberId of currentMembers) {
    io.to(`user:${memberId}`).emit(previousMembers.includes(memberId) ? 'project:updated' : 'project:added', previousMembers.includes(memberId) ? { project } : { projectId: String(project._id) });
  }
  for (const memberId of previousMembers.filter(memberId => !currentMembers.includes(memberId))) {
    io.to(`user:${memberId}`).emit('project:removed', { projectId: String(project._id) });
    io.in(`user:${memberId}`).socketsLeave(String(project._id));
  }
  const newlyAssigned = currentMembers.filter(memberId => !previousMembers.includes(memberId));
  await notifyUsers(io, newlyAssigned, { actor: req.user._id, project: project._id, type: 'project-assigned', message: `You were assigned to project “${project.name}”.` });
  res.json({ project });
});

router.delete('/:projectId', requireAdmin, async (req, res) => {
  const project = await projectForMember(req.params.projectId, req.user);
  await Task.deleteMany({ project: project._id });
  await project.deleteOne();
  const io = req.app.get('io');
  io.to(project._id.toString()).emit('project:deleted', { projectId: project._id.toString(), name: project.name });
  for (const member of project.members) io.to(`user:${member}`).emit('project:deleted', { projectId: project._id.toString(), name: project.name });
  res.status(204).end();
});

router.post('/:projectId/members', requireAdmin, async (req, res) => {
  const project = await projectForMember(req.params.projectId, req.user);
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254) throw new HttpError(400, 'A valid member email is required');
  const user = await User.findOne({ email }).select('_id name email role');
  if (!user) throw new HttpError(404, 'No registered account found for that email');
  if (!project.members.some(id => id.toString() === user._id.toString())) project.members.push(user._id);
  await project.save();
  await project.populate('members', membersFields);
  const io = req.app.get('io');
  io.to(project._id.toString()).emit('project:members-updated', { projectId: String(project._id), members: project.members });
  io.to(`user:${user._id}`).emit('project:added', { projectId: String(project._id) });
  await notifyUsers(io, [user._id], { actor: req.user._id, project: project._id, type: 'project-assigned', message: `You were assigned to project “${project.name}”.` });
  res.json({ project });
});

router.delete('/:projectId/members/:userId', requireAdmin, async (req, res) => {
  const project = await projectForMember(req.params.projectId, req.user);
  if (project.owner.toString() === req.params.userId) throw new HttpError(400, 'Project owner cannot be unassigned');
  project.members = project.members.filter(id => id.toString() !== req.params.userId);
  await project.save();
  await project.populate('members', membersFields);
  const io = req.app.get('io');
  io.to(project._id.toString()).emit('project:members-updated', { projectId: String(project._id), members: project.members });
  io.to(`user:${req.params.userId}`).emit('project:removed', { projectId: String(project._id) });
  io.in(`user:${req.params.userId}`).socketsLeave(String(project._id));
  res.json({ project });
});

export default router;
