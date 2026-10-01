import { useState } from 'react';
import { FolderKanban, Plus, SquareArrowOutUpRight } from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../api.js';
import { getProjectPath, TASK_COLUMNS } from '../constants.js';
import Modal from '../components/Modal.jsx';
import DashboardTaskForm from '../components/forms/DashboardTaskForm.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';

export default function ProjectsPage() {
  const { projects, tasks, upsertTask } = useWorkspace();
  const { session } = useAuth();
  const isAdmin = session.user.role === 'admin';
  const { onCreateProject, notify } = useOutletContext();
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [taskError, setTaskError] = useState('');

  async function createTask(projectId, values) {
    if (!values) { setCreateTaskOpen(false); return; }
    setTaskError('');
    try {
      const { task } = await api.createTask(session.token, projectId, values);
      upsertTask(task);
      setCreateTaskOpen(false);
      notify('Task created and assigned');
    } catch (error) { setTaskError(error.message); }
  }

  return (
    <section className="all-projects-view">
      <div className="all-projects-heading">
        <div><span className="eyebrow">{isAdmin ? 'ADMIN WORKSPACE' : 'YOUR WORKSPACE'}</span><h1>{isAdmin ? 'Admin Dashboard' : 'User Dashboard'}</h1><p>{isAdmin ? 'Create projects and tasks, assign users, and track live updates.' : 'Projects and tasks assigned to you, updated in real time.'}</p></div>
        {isAdmin && <div className="dashboard-actions"><button className="secondary" onClick={onCreateProject}><Plus size={16} /> Create project</button><button className="primary" onClick={() => { setTaskError(''); setCreateTaskOpen(true); }} disabled={projects.length === 0} title={projects.length === 0 ? 'Create a project first' : undefined}><Plus size={16} /> Create task</button></div>}
      </div>

      {!isAdmin && <div className="notice role-notice">You are signed in as a user. Admin project and task controls require an Admin account.</div>}

      <section className="dashboard-section">
        <div className="dashboard-section-heading"><h2>Projects <span>{projects.length}</span></h2>{isAdmin && projects.length === 0 && <button className="text-button" onClick={onCreateProject}>Create your first project</button>}</div>
        {projects.length ? <div className="project-grid">
          {projects.map(project => {
            const progress = project.taskCount ? (project.completedCount || 0) / project.taskCount * 100 : 0;
            return <Link key={project._id} className="project-card" to={getProjectPath(project._id)}>
              <div className="project-card-top"><span className="project-mark">{project.name.slice(0, 1).toUpperCase()}</span><span className="project-card-arrow"><SquareArrowOutUpRight size={14} /></span></div>
              <h2>{project.name}</h2><p>{project.description || 'No description yet.'}</p>
              <div className="project-date-line">{project.startDate && <span>Starts {new Date(project.startDate).toLocaleDateString()}</span>}{project.dueDate && <span>Due {new Date(project.dueDate).toLocaleDateString()}</span>}</div>
              <div className="project-card-footer"><span>{project.taskCount || 0} tasks</span><span>{project.completedCount || 0} completed</span><span className="project-card-members">{project.members?.length || 1} members</span></div>
              <div className="project-progress"><i style={{ width: `${progress}%` }} /></div>
            </Link>;
          })}
        </div> : <div className="dashboard-empty"><FolderKanban size={20} /><span>{isAdmin ? 'Create a project to start assigning work.' : 'Projects assigned to you will appear here.'}</span></div>}
      </section>

      <section className="dashboard-section dashboard-tasks-section">
        <div className="dashboard-section-heading"><h2>{isAdmin ? 'All tasks' : 'Tasks assigned to you'} <span>{tasks.length}</span></h2></div>
        {tasks.length ? <div className="dashboard-task-list">{tasks.map(task => {
          const projectId = String(task.project?._id || task.project || '');
          const projectName = task.project?.name || projects.find(project => project._id === projectId)?.name || 'Project';
          return <Link className="dashboard-task-row" key={task._id} to={getProjectPath(projectId)}>
            <div className="dashboard-task-main"><strong>{task.title}</strong><span>{projectName}{isAdmin && task.assignee?.name ? ` · ${task.assignee.name}` : ''}</span></div>
            <span className={`priority ${task.priority}`}><span />{task.priority}</span>
            <span className={`task-status-badge status-${task.status}`}>{TASK_COLUMNS.find(column => column.id === task.status)?.title || task.status}</span>
            <span className="dashboard-task-date">{task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : 'No deadline'}</span>
          </Link>;
        })}</div> : <div className="dashboard-empty"><span>{isAdmin ? 'Tasks created in your projects will appear here.' : 'Tasks assigned to you will appear here.'}</span></div>}
      </section>

      {createTaskOpen && <Modal title="Create a task" onClose={() => setCreateTaskOpen(false)}><DashboardTaskForm projects={projects} onSubmit={createTask} />{taskError && <div className="form-error dashboard-form-error">{taskError}</div>}</Modal>}
    </section>
  );
}
