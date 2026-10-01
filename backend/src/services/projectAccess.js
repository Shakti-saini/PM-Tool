import Project from '../models/Project.js';
import { HttpError } from '../middleware/errors.js';

export async function projectForMember(projectId, user) {
  const userId = user?._id || user;
  const project = await Project.findOne(user?.role === 'admin' ? { _id: projectId } : { _id: projectId, members: userId });
  if (!project) throw new HttpError(404, 'Project not found');
  return project;
}
