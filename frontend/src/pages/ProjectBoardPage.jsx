import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CheckCheck, LayoutGrid, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { TASK_COLUMNS } from '../constants.js';
import Avatar from '../components/Avatar.jsx';
import MembersForm from '../components/forms/MembersForm.jsx';
import ProjectForm from '../components/forms/ProjectForm.jsx';
import TaskForm from '../components/forms/TaskForm.jsx';
import Modal from '../components/Modal.jsx';
import TaskCard from '../components/TaskCard.jsx';
import TaskDetails from '../components/TaskDetails.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';

export default function ProjectBoardPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const isAdmin = session.user.role === 'admin';
  const { setProjects, reloadProjects, socket, joinedProjectIds } = useWorkspace();
  const { notify } = useOutletContext();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersError, setUsersError] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setUsersLoading(true);
    setUsersError('');
    try { const result = await api.users(session.token); setUsers(result.users); }
    catch (requestError) { setUsersError(requestError.message); }
    finally { setUsersLoading(false); }
  }, [isAdmin, session.token]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const loadProject = useCallback(async () => {
    try {
      const { project: result } = await api.project(session.token, projectId);
      setProject(result);
      setProjects(current => current.map(item => item._id === result._id ? { ...item, ...result } : item));
    } catch (err) {
      setError(err.message);
      if (err.status === 401) signOut();
      if (err.status === 404) navigate('/projects', { replace: true });
    } finally {
      setLoadingProject(false);
    }
  }, [session.token, projectId, setProjects, signOut, navigate]);

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const { tasks: result } = await api.tasks(session.token, projectId);
      setTasks(result);
      setError('');
    } catch (err) {
      setError(err.message);
      if (err.status === 401) signOut();
    } finally {
      setLoadingTasks(false);
    }
  }, [session.token, projectId, signOut]);

  useEffect(() => {
    setProject(null);
    setLoadingProject(true);
    setError('');
    loadProject();
  }, [loadProject]);
  useEffect(() => { loadTasks(); }, [loadTasks]);
  useEffect(() => {
    if (joinedProjectIds.includes(projectId)) loadTasks();
  }, [joinedProjectIds, projectId, loadTasks]);

  useEffect(() => {
    if (!socket) return undefined;
    const belongsToProject = task => String(task.project?._id || task.project) === projectId;
    const canViewTask = task => isAdmin || String(task.assignee?._id || task.assignee || '') === session.user.id;
    const upsertVisibleTask = task => setTasks(current => {
      if (!canViewTask(task)) return current.filter(item => item._id !== task._id);
      return current.some(item => item._id === task._id) ? current.map(item => item._id === task._id ? task : item) : [task, ...current];
    });
    const onConnectError = error => setNotice(error.message || 'Live updates unavailable');
    const onTaskCreated = ({ task }) => {
      if (belongsToProject(task) && canViewTask(task)) upsertVisibleTask(task);
    };
    const onTaskUpdated = ({ task }) => {
      if (belongsToProject(task)) upsertVisibleTask(task);
    };
    const onTaskStatusUpdated = ({ task, changedBy }) => {
      if (!belongsToProject(task)) return;
      upsertVisibleTask(task);
      if (changedBy?.id !== session.user.id) notify(`${changedBy?.name || 'A teammate'} moved “${task.title}” to ${TASK_COLUMNS.find(column => column.id === task.status)?.title}.`);
    };
    const onTaskDeleted = ({ taskId: deletedTaskId, projectId: changedProjectId }) => {
      if (changedProjectId === projectId) setTasks(current => current.filter(item => item._id !== deletedTaskId));
    };
    const onCommentAdded = ({ taskId, projectId: changedProjectId, comment }) => {
      if (changedProjectId !== projectId) return;
      setTasks(current => current.map(item => item._id === taskId && !item.comments?.some(entry => entry._id === comment._id) ? { ...item, comments: [...(item.comments || []), comment] } : item));
    };
    const onProjectUpdated = ({ project: updatedProject }) => {
      if (updatedProject._id === projectId) setProject(updatedProject);
    };
    const onMembersUpdated = ({ projectId: changedProjectId, members }) => {
      if (changedProjectId !== projectId) return;
      const stillMember = members.some(member => String(member._id || member.id || member) === session.user.id);
      if (!stillMember) {
        notify('You no longer have access to this project.');
        navigate('/projects', { replace: true });
        return;
      }
      setProject(current => current ? { ...current, members } : current);
      setProjects(current => current.map(item => item._id === projectId ? { ...item, members } : item));
    };
    const onProjectDeleted = ({ projectId: deletedProjectId }) => {
      if (deletedProjectId !== projectId) return;
      notify('This project was deleted.');
      navigate('/projects', { replace: true });
    };
    const onProjectRemoved = ({ projectId: removedProjectId }) => {
      if (removedProjectId !== projectId) return;
      notify('You no longer have access to this project.');
      navigate('/projects', { replace: true });
    };

    socket.on('connect_error', onConnectError);
    socket.on('task:created', onTaskCreated);
    socket.on('task:updated', onTaskUpdated);
    socket.on('task:status-updated', onTaskStatusUpdated);
    socket.on('task:deleted', onTaskDeleted);
    socket.on('task:comment-added', onCommentAdded);
    socket.on('project:updated', onProjectUpdated);
    socket.on('project:members-updated', onMembersUpdated);
    socket.on('project:deleted', onProjectDeleted);
    socket.on('project:removed', onProjectRemoved);

    return () => {
      socket.off('connect_error', onConnectError);
      socket.off('task:created', onTaskCreated);
      socket.off('task:updated', onTaskUpdated);
      socket.off('task:status-updated', onTaskStatusUpdated);
      socket.off('task:deleted', onTaskDeleted);
      socket.off('task:comment-added', onCommentAdded);
      socket.off('project:updated', onProjectUpdated);
      socket.off('project:members-updated', onMembersUpdated);
      socket.off('project:deleted', onProjectDeleted);
      socket.off('project:removed', onProjectRemoved);
    };
  }, [socket, session.user.id, isAdmin, projectId, notify, navigate, setProjects]);

  const filteredTasks = useMemo(() => tasks.filter(task => (
    (priorityFilter === 'all' || task.priority === priorityFilter)
    && `${task.title} ${task.description || ''}`.toLowerCase().includes(search.toLowerCase())
  )), [tasks, priorityFilter, search]);
  const completedTasks = tasks.filter(task => task.status === 'done').length;

  async function saveTask(values) {
    if (!values) { setModal(null); return; }
    if (modal.task) {
      const { task } = await api.updateTask(session.token, projectId, modal.task._id, values);
      setTasks(current => current.map(item => item._id === task._id ? task : item));
      notify('Task updated');
    } else {
      const { task } = await api.createTask(session.token, projectId, values);
      setTasks(current => current.some(item => item._id === task._id) ? current : [task, ...current]);
      notify('Task added');
    }
    setModal(null);
  }

  async function addComment(body, attachments) {
    const { task: updated } = await api.addComment(session.token, projectId, modal.task._id, body, attachments);
    setTasks(current => current.map(item => item._id === updated._id ? updated : item));
  }

  async function changeTaskStatus(task, status) {
    setNotice('');
    try {
      const { task: updatedTask } = await api.updateStatus(session.token, projectId, task._id, status);
      setTasks(current => current.map(item => item._id === updatedTask._id ? updatedTask : item));
    } catch (err) { setNotice(err.message); }
  }

  async function deleteTask(task) {
    if (!window.confirm(`Delete “${task.title}”? This cannot be undone.`)) return;
    try {
      await api.deleteTask(session.token, projectId, task._id);
      setTasks(current => current.filter(item => item._id !== task._id));
      notify('Task deleted');
    } catch (err) { setNotice(err.message); }
  }

  async function saveProject(values) {
    if (!values) { setModal(null); return; }
    const { project: updatedProject } = await api.updateProject(session.token, projectId, values);
    setProject(updatedProject);
    setProjects(current => current.map(item => item._id === projectId ? { ...item, ...updatedProject } : item));
    setModal(null);
    notify('Project updated');
  }

  async function deleteProject() {
    if (!window.confirm(`Delete “${project.name}” and all its tasks? This cannot be undone.`)) return;
    try {
      await api.deleteProject(session.token, projectId);
      await reloadProjects();
      notify('Project deleted');
      navigate('/projects', { replace: true });
    } catch (err) { setNotice(err.message); }
  }

  async function inviteMember(email) {
    const { project: updatedProject } = await api.inviteMember(session.token, projectId, email);
    setProject(updatedProject);
    setProjects(current => current.map(item => item._id === projectId ? { ...item, ...updatedProject } : item));
    notify('Project member added');
  }

  async function removeMember(member) {
    if (!window.confirm(`Remove ${member.name} from this project?`)) return;
    try {
      const { project: updatedProject } = await api.removeMember(session.token, projectId, member._id || member.id);
      setProject(updatedProject);
      setProjects(current => current.map(item => item._id === projectId ? { ...item, ...updatedProject } : item));
      notify('Member removed');
    } catch (err) { setNotice(err.message); }
  }

  if (loadingProject && !project) return <div className="splash"><span className="brand-mark">◌</span><span>Loading project</span></div>;
  if (!project) return <div className="page-error">{error || 'Project could not be loaded.'}</div>;

  return (
    <>
      {error && <div className="page-error"><span>{error}</span><button onClick={() => { setError(''); loadTasks(); }}>Retry</button></div>}
      <ProjectHeader project={project} isAdmin={isAdmin} onEdit={() => setModal({ type: 'project' })} onMembers={() => setModal({ type: 'members' })} onDelete={deleteProject} onAddTask={() => setModal({ type: 'task' })} />
      <ProjectStats tasks={tasks} completedTasks={completedTasks} />
      <section className="board-section">
        <div className="board-toolbar">
          <div><h2>Task board <span>{tasks.length}</span></h2><p>{isAdmin ? 'Manage and track every task in this project.' : 'Tasks assigned to you in this project.'}</p></div>
          <div className="board-controls"><label className="search-box"><Search size={15} /><input placeholder="Search tasks…" value={search} onChange={event => setSearch(event.target.value)} /><kbd>⌘ K</kbd></label><select className="filter-select" value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)}><option value="all">All priorities</option><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select>{isAdmin && <button className="primary add-task-button" onClick={() => setModal({ type: 'task' })}><Plus size={15} /> Add task</button>}</div>
        </div>
        {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice('')}><X size={15} /></button></div>}
        <div className="kanban-board">{TASK_COLUMNS.map(column => <TaskColumn key={column.id} column={column} tasks={filteredTasks.filter(task => task.status === column.id)} loading={loadingTasks} isAdmin={isAdmin} onAddTask={() => setModal({ type: 'task', status: column.id })} onEditTask={task => setModal({ type: 'task', task })} onTaskDetails={task => setModal({ type: 'details', task })} onDeleteTask={deleteTask} onStatusChange={changeTaskStatus} />)}</div>
        <div className="board-footer"><span><i className="live-dot-small" /> Live sync is on</span><span>Assignments and changes appear instantly</span><span className="footer-avatar"><Avatar name={session.user.name} />{session.user.name.split(' ')[0]} is here</span></div>
      </section>
      {modal?.type === 'task' && isAdmin && <Modal title={modal.task ? 'Edit task' : 'Create a task'} onClose={() => setModal(null)}><TaskForm key={modal.task?._id || modal.status || 'new'} task={modal.task} status={modal.status} members={project.members || []} onSubmit={saveTask} /></Modal>}
      {modal?.type === 'details' && <Modal wide title={modal.task.title} onClose={() => setModal(null)}><TaskDetails task={tasks.find(task => task._id === modal.task._id) || modal.task} onComment={addComment} onClose={() => setModal(null)} /></Modal>}
      {modal?.type === 'project' && isAdmin && <Modal title="Edit project" onClose={() => setModal(null)}><ProjectForm project={project} users={users.filter(user => user.role !== 'admin')} usersLoading={usersLoading} usersError={usersError} onRetryUsers={loadUsers} onSubmit={saveProject} /></Modal>}
      {modal?.type === 'members' && isAdmin && <Modal title="Project members" onClose={() => setModal(null)}><MembersForm project={project} user={session.user} onInvite={inviteMember} onRemove={removeMember} onClose={() => setModal(null)} /></Modal>}
    </>
  );
}

function ProjectHeader({ project, isAdmin, onEdit, onMembers, onDelete, onAddTask }) {
  return (
    <section className="project-heading">
      <div className="project-title-group"><div className="project-title-line"><span className="project-mark">{project.name.slice(0, 1).toUpperCase()}</span><div><div className="eyebrow">PROJECT / {new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(project.createdAt))}</div><h1>{project.name}{isAdmin && <button className="edit-title" title="Edit project" onClick={onEdit}><Pencil size={14} /></button>}</h1></div></div>{project.description && <p className="project-description">{project.description}</p>}<div className="project-date-line">{project.startDate && <span>Starts {new Date(project.startDate).toLocaleDateString()}</span>}{project.dueDate && <span>Deadline {new Date(project.dueDate).toLocaleDateString()}</span>}</div></div>
      <div className="project-heading-actions"><span className="collaborators" title="Project members"><span className="avatar-stack">{(project.members || []).slice(0, 3).map(member => <Avatar key={member._id || member.id} name={member.name} />)}</span><span className="member-chip">{project.members?.length || 1} {project.members?.length === 1 ? 'member' : 'members'}</span></span>{isAdmin && <><button className="secondary small" onClick={onMembers}>Manage team</button><button className="secondary small" onClick={onAddTask}><Plus size={15} /> Add task</button><button className="icon-button" title="Edit project" onClick={onEdit}><Pencil size={16} /></button><button className="icon-button" title="Delete project" onClick={onDelete}><Trash2 size={16} /></button></>}</div>
    </section>
  );
}

function ProjectStats({ tasks, completedTasks }) {
  const progress = tasks.length ? Math.round(completedTasks / tasks.length * 100) : 0;
  return (
    <section className="stats-row">
      <div className="stat-card"><span className="stat-icon blue"><LayoutGrid size={16} /></span><div><strong>{tasks.length}</strong><span>Total tasks</span></div><span className="stat-hint">in this project</span></div>
      <div className="stat-card"><span className="stat-icon green"><CheckCheck size={16} /></span><div><strong>{completedTasks}</strong><span>Completed</span></div><span className="stat-hint">{tasks.length ? `${progress}% of total` : 'ready when you are'}</span></div>
      <div className="stat-card"><span className="stat-icon orange"><Activity size={16} /></span><div><strong>{tasks.length - completedTasks}</strong><span>In motion</span></div><span className="stat-hint">still on the board</span></div>
      <div className="progress-stat"><div className="progress-title"><span>Project progress</span><strong>{progress}%</strong></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><span className="stat-hint">Keep the momentum going ✨</span></div>
    </section>
  );
}

function TaskColumn({ column, tasks, loading, isAdmin, onAddTask, onEditTask, onTaskDetails, onDeleteTask, onStatusChange }) {
  return (
    <section className="kanban-column">
      <div className="column-head"><div className="column-name"><span className={`column-dot ${column.accent}`} />{column.title}<span className="column-count">{tasks.length}</span></div>{isAdmin && <button className="icon-button tiny" title={`Add ${column.title} task`} onClick={onAddTask}><Plus size={16} /></button>}</div>
      <div className="task-list">{loading ? <div className="skeleton-card" /> : tasks.map(task => <TaskCard key={task._id} task={task} onEdit={onEditTask} onDetails={onTaskDetails} onDelete={onDeleteTask} onStatus={onStatusChange} canManage={isAdmin} />)}{isAdmin && !loading && tasks.length === 0 && <button className="column-empty" onClick={onAddTask}><Plus size={16} /><span>Add a task</span></button>}</div>
      {isAdmin && <button className="column-add" onClick={onAddTask}><Plus size={14} /> Add task</button>}
    </section>
  );
}
