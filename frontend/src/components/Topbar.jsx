import { Bell } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import Avatar from './Avatar.jsx';

export default function Topbar({ projects, user, unreadCount = 0 }) {
  const { pathname } = useLocation();
  const project = projects.find(item => pathname === `/projects/${item._id}`);
  const title = project?.name || (pathname === '/projects' ? 'All projects' : 'Overview');

  return (
    <header className="topbar">
      <div className="breadcrumbs"><span>Projects</span><span className="crumb-slash">/</span><strong>{title}</strong></div>
      <div className="top-actions"><span className="sync-status"><i /> Live sync</span><Link to="/notifications" className="icon-button notification-button" title="Notifications"><Bell size={18} />{unreadCount > 0 && <i />}</Link><Avatar name={user.name} /></div>
    </header>
  );
}
