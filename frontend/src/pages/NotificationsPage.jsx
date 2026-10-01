import { useEffect } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext.jsx';

export default function NotificationsPage() {
  const { notifications, markAllNotificationsRead } = useWorkspace();
  useEffect(() => { markAllNotificationsRead().catch(() => {}); }, [markAllNotificationsRead]);
  return <section className="all-projects-view"><div className="all-projects-heading"><div><span className="eyebrow">ACTIVITY</span><h1>Notifications</h1><p>Assignments and updates across your workspace.</p></div><button className="secondary" onClick={() => markAllNotificationsRead()}><CheckCheck size={15} /> Mark all read</button></div><div className="notification-list">{notifications.length ? notifications.map(item => <article className={`notification-item ${item.readAt ? '' : 'unread'}`} key={item._id}><span className="notification-icon"><Bell size={16} /></span><div><p>{item.message}</p><small>{item.actor?.name ? `${item.actor.name} · ` : ''}{new Date(item.createdAt).toLocaleString()}</small></div></article>) : <div className="all-projects-empty"><Bell size={27} /><h2>You're all caught up</h2><p>New assignment and task updates will appear here.</p></div>}</div></section>;
}
