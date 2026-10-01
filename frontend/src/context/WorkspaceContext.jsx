import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { connectSocket } from '../socket.js';
import { useAuth } from './AuthContext.jsx';

const WorkspaceContext = createContext(null);

function getProjectId(task) {
  const id = task?.project?._id || task?.project;
  return id ? String(id) : null;
}

export function WorkspaceProvider({ children }) {
  const { session, signOut } = useAuth();
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [socket, setSocket] = useState(null);
  const [joinedProjectIds, setJoinedProjectIds] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const joinedProjects = useRef(new Set());

  const reloadProjects = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const result = await api.projects(session.token);
      setProjects(result.projects);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.status === 401) signOut();
    } finally {
      setLoading(false);
    }
  }, [session, signOut]);

  const reloadTasks = useCallback(async () => {
    if (!session) return;
    try {
      const result = await api.workspaceTasks(session.token);
      setTasks(result.tasks);
    } catch (requestError) {
      if (requestError.status === 401) signOut();
    }
  }, [session, signOut]);

  const upsertTask = useCallback(task => {
    const canSeeTask = session.user.role === 'admin' || String(task.assignee?._id || task.assignee || '') === session.user.id;
    setTasks(current => {
      if (!canSeeTask) return current.filter(item => item._id !== task._id);
      return current.some(item => item._id === task._id)
        ? current.map(item => item._id === task._id ? { ...item, ...task, project: task.project?.name ? task.project : item.project } : item)
        : [task, ...current];
    });
  }, [session.user.id, session.user.role]);

  useEffect(() => {
    if (!session) {
      setProjects([]);
      setTasks([]);
      return;
    }
    reloadProjects();
    reloadTasks();
  }, [session, reloadProjects, reloadTasks]);

  const reloadNotifications = useCallback(async () => {
    if (!session) return;
    const result = await api.notifications(session.token);
    setNotifications(result.notifications);
    setUnreadCount(result.unreadCount);
  }, [session]);

  useEffect(() => { reloadNotifications().catch(() => {}); }, [reloadNotifications]);

  useEffect(() => {
    if (!session) {
      setSocket(null);
      return undefined;
    }

    const connection = connectSocket(session.token);
    setSocket(connection);

    const refreshProjects = () => reloadProjects();
    const removeProject = ({ projectId }) => {
      setProjects(current => current.filter(project => project._id !== projectId));
      reloadProjects();
    };
    const updateProject = ({ project }) => {
      setProjects(current => current.map(item => item._id === project._id ? { ...item, ...project } : item));
    };
    const updateMembers = ({ projectId, members }) => {
      const isMember = members.some(member => String(member._id || member.id || member) === session.user.id);
      setProjects(current => isMember
        ? current.map(project => project._id === projectId ? { ...project, members } : project)
        : current.filter(project => project._id !== projectId));
      if (!isMember) reloadProjects();
    };
    const applyTask = ({ task }) => { if (task) upsertTask(task); };
    const deleteWorkspaceTask = ({ taskId }) => setTasks(current => current.filter(task => task._id !== taskId));
    const addWorkspaceComment = ({ taskId, comment }) => setTasks(current => current.map(task => {
      if (task._id !== taskId || task.comments?.some(item => item._id === comment._id)) return task;
      return { ...task, comments: [...(task.comments || []), comment] };
    }));
    const removeProjectTasks = ({ projectId }) => setTasks(current => current.filter(task => getProjectId(task) !== projectId));
    const addTaskCount = ({ task }) => {
      if (session.user.role !== 'admin' && String(task.assignee?._id || task.assignee || '') !== session.user.id) return;
      const projectId = getProjectId(task);
      if (!projectId) return;
      setProjects(current => current.map(project => project._id === projectId ? {
        ...project,
        taskCount: (project.taskCount || 0) + 1,
        completedCount: (project.completedCount || 0) + (task.status === 'done' ? 1 : 0)
      } : project));
    };
    const removeTaskCount = ({ projectId, status }) => {
      if (session.user.role !== 'admin') { reloadProjects(); return; }
      setProjects(current => current.map(project => project._id === projectId ? {
        ...project,
        taskCount: Math.max(0, (project.taskCount || 0) - 1),
        completedCount: Math.max(0, (project.completedCount || 0) - (status === 'done' ? 1 : 0))
      } : project));
    };
    const updateTaskCount = ({ task, previousStatus, previousAssignee }) => {
      const projectId = getProjectId(task);
      if (!projectId) return;
      if (session.user.role !== 'admin') {
        const wasAssigned = String(previousAssignee || '') === session.user.id;
        const isAssigned = String(task.assignee?._id || task.assignee || '') === session.user.id;
        if (!wasAssigned && !isAssigned) return;
        const totalDelta = Number(isAssigned) - Number(wasAssigned);
        const doneDelta = Number(isAssigned && task.status === 'done') - Number(wasAssigned && previousStatus === 'done');
        setProjects(current => current.map(project => project._id === projectId ? {
          ...project,
          taskCount: Math.max(0, (project.taskCount || 0) + totalDelta),
          completedCount: Math.max(0, (project.completedCount || 0) + doneDelta)
        } : project));
        return;
      }
      if (previousStatus === task.status) return;
      const delta = Number(task.status === 'done') - Number(previousStatus === 'done');
      setProjects(current => current.map(project => project._id === projectId ? {
        ...project,
        completedCount: Math.max(0, (project.completedCount || 0) + delta)
      } : project));
    };

    connection.on('project:created', refreshProjects);
    connection.on('project:added', refreshProjects);
    connection.on('project:removed', removeProject);
    connection.on('project:updated', updateProject);
    connection.on('project:deleted', removeProject);
    connection.on('project:members-updated', updateMembers);
    connection.on('project:deleted', removeProjectTasks);
    connection.on('project:removed', removeProjectTasks);
    connection.on('task:created', addTaskCount);
    connection.on('task:deleted', removeTaskCount);
    connection.on('task:status-updated', updateTaskCount);
    connection.on('task:created', applyTask);
    connection.on('task:updated', applyTask);
    connection.on('task:status-updated', applyTask);
    connection.on('task:deleted', deleteWorkspaceTask);
    connection.on('task:comment-added', addWorkspaceComment);
    const notification = ({ notification: item }) => {
      setNotifications(current => [item, ...current].slice(0, 50));
      setUnreadCount(count => count + 1);
    };
    connection.on('notification:new', notification);

    return () => {
      connection.disconnect();
      connection.off('notification:new', notification);
      joinedProjects.current.clear();
    };
  }, [session, reloadProjects, reloadTasks, upsertTask]);

  useEffect(() => {
    if (!socket) return undefined;

    function syncProjectRooms() {
      if (!socket.connected) return;
      const desired = new Set(projects.map(project => project._id));

      for (const projectId of joinedProjects.current) {
        if (!desired.has(projectId)) {
          socket.emit('project:leave', { projectId });
          joinedProjects.current.delete(projectId);
          setJoinedProjectIds([...joinedProjects.current]);
        }
      }

      for (const projectId of desired) {
        if (joinedProjects.current.has(projectId)) continue;
        joinedProjects.current.add(projectId);
        socket.emit('project:join', { projectId }, result => {
          if (result?.error) {
            joinedProjects.current.delete(projectId);
            setJoinedProjectIds([...joinedProjects.current]);
            reloadProjects();
          } else {
            setJoinedProjectIds([...joinedProjects.current]);
          }
        });
      }
    }

    function clearJoinedRooms() {
      joinedProjects.current.clear();
      setJoinedProjectIds([]);
    }

    socket.on('connect', syncProjectRooms);
    socket.on('disconnect', clearJoinedRooms);
    syncProjectRooms();
    return () => {
      socket.off('connect', syncProjectRooms);
      socket.off('disconnect', clearJoinedRooms);
    };
  }, [socket, projects, reloadProjects]);

  const markNotificationRead = useCallback(async id => {
    await api.markNotificationRead(session.token, id);
    setNotifications(items => items.map(item => item._id === id ? { ...item, readAt: new Date().toISOString() } : item));
    setUnreadCount(count => Math.max(0, count - 1));
  }, [session]);
  const markAllNotificationsRead = useCallback(async () => {
    await api.markAllNotificationsRead(session.token);
    setNotifications(items => items.map(item => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    setUnreadCount(0);
  }, [session]);
  const value = useMemo(() => ({ projects, setProjects, tasks, setTasks, upsertTask, reloadTasks, loading, error, setError, reloadProjects, socket, joinedProjectIds, notifications, unreadCount, reloadNotifications, markNotificationRead, markAllNotificationsRead }), [projects, setProjects, tasks, setTasks, upsertTask, reloadTasks, loading, error, reloadProjects, socket, joinedProjectIds, notifications, unreadCount, reloadNotifications, markNotificationRead, markAllNotificationsRead]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return context;
}
