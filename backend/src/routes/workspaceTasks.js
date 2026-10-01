import { Router } from 'express';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const filter = {};
  if (!isAdmin) {
    const projectIds = await Project.distinct('_id', { members: req.user._id });
    filter.project = { $in: projectIds };
    filter.assignee = req.user._id;
  }
  const tasks = await Task.find(filter)
    .select('title status priority dueDate assignee project updatedAt')
    .populate('project', 'name')
    .populate('assignee', 'name email')
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();
  res.json({ tasks });
});

export default router;
