import { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { getProjectPath } from '../constants.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import Modal from '../components/Modal.jsx';
import ProjectForm from '../components/forms/ProjectForm.jsx';
import Sidebar from '../components/Sidebar.jsx';
import Toast from '../components/Toast.jsx';
import Topbar from '../components/Topbar.jsx';

export default function AppLayout() {
  const { session, signOut } = useAuth();
  const { projects, loading, error, setError, reloadProjects, unreadCount } = useWorkspace();
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const navigate = useNavigate();

  const loadUsers = useCallback(async () => {
    if (session.user.role !== 'admin') return;
    setUsersLoading(true);
    setUsersError('');
    try {
      const result = await api.users(session.token);
      setUsers(result.users);
    } catch (requestError) {
      setUsersError(requestError.message);
    } finally {
      setUsersLoading(false);
    }
  }, [session]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const notify = useCallback(message => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  }, []);

  async function createProject(values) {
    if (!values) { setCreateProjectOpen(false); return; }
    const { project } = await api.createProject(session.token, values);
    await reloadProjects();
    setCreateProjectOpen(false);
    notify('Project created');
    navigate(getProjectPath(project._id));
  }

  return (
    <div className="app-shell">
      <Sidebar projects={projects} user={session.user} unreadCount={unreadCount} onCreateProject={() => setCreateProjectOpen(true)} onSignOut={signOut} />
      <main className="main-area">
        <Topbar projects={projects} user={session.user} unreadCount={unreadCount} />
        {error && <div className="page-error"><span>{error}</span><button onClick={() => { setError(''); reloadProjects(); }}>Retry</button></div>}
        {loading && projects.length === 0 ? <div className="splash"><span className="brand-mark">◌</span><span>Loading your workspace</span></div> : <Outlet context={{ notify, onCreateProject: () => setCreateProjectOpen(true) }} />}
      </main>
      {createProjectOpen && session.user.role === 'admin' && <Modal title="Create a project" onClose={() => setCreateProjectOpen(false)}><ProjectForm users={users.filter(user => user.role !== 'admin')} usersLoading={usersLoading} usersError={usersError} onRetryUsers={loadUsers} onSubmit={createProject} /></Modal>}
      <Toast message={toast} />
    </div>
  );
}
