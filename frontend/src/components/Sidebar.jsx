import { Bell, CircleHelp, CirclePlus, Command, FolderKanban, LogOut, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import { getProjectPath, PROJECTS_PATH } from '../constants.js';

export default function Sidebar({ projects, user, unreadCount = 0, onCreateProject, onSignOut }) {
  return (
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Command size={17} /></span>orbit<span className="brand-dot">.</span></div>
      <div className="workspace-label">WORKSPACE</div>
      <NavLink to={PROJECTS_PATH} end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><FolderKanban size={17} /> All projects <span className="nav-count">{projects.length}</span></NavLink>
      <NavLink to="/notifications" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Bell size={17} /> Notifications {unreadCount > 0 && <span className="nav-count">{unreadCount}</span>}</NavLink>
      {user.role === 'admin' && <NavLink to="/team" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Users size={17} /> Team management</NavLink>}

      <div className="sidebar-section"><span>YOUR PROJECTS</span></div>
      <div className="project-nav">
        {projects.map(project => (
          <NavLink key={project._id} to={getProjectPath(project._id)} className={({ isActive }) => `project-nav-item ${isActive ? 'selected' : ''}`}>
            <span className="project-icon">{project.name.slice(0, 1).toUpperCase()}</span>
            <span className="project-nav-name">{project.name}</span>
            <span className="project-nav-count">{project.taskCount}</span>
          </NavLink>
        ))}
      </div>
      {user.role === 'admin' && <button className="nav-item add-project" onClick={onCreateProject}><CirclePlus size={17} /> Create project</button>}

      <div className="sidebar-bottom">
        <button className="nav-item"><CircleHelp size={17} /> Help &amp; feedback</button>
        <div className="user-card"><Avatar name={user.name} /><div className="user-info"><strong>{user.name}</strong><span>{user.email}</span></div><button title="Sign out" className="icon-button tiny" onClick={onSignOut}><LogOut size={16} /></button></div>
      </div>
    </aside>
  );
}
