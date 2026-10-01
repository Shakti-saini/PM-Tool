import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { WorkspaceProvider } from './context/WorkspaceContext.jsx';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import AppLayout from './layouts/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ProjectBoardPage from './pages/ProjectBoardPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import TeamPage from './pages/TeamPage.jsx';
import { PROJECTS_PATH } from './constants.js';

function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="splash"><span className="brand-mark">◌</span><span>Loading your workspace</span></div>;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <WorkspaceProvider><Outlet /></WorkspaceProvider>;
}

function RequireAdmin() {
  const { session } = useAuth();
  return session?.user?.role === 'admin' ? <Outlet /> : <Navigate to={PROJECTS_PATH} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to={PROJECTS_PATH} replace />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectBoardPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route element={<RequireAdmin />}><Route path="team" element={<TeamPage />} /></Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={PROJECTS_PATH} replace />} />
    </Routes>
  );
}

export default function App() {
  return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>;
}
