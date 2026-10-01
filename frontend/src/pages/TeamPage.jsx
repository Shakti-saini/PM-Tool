import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import Avatar from '../components/Avatar.jsx';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function TeamPage() {
  const { session } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { api.users(session.token).then(result => setUsers(result.users)).catch(err => setError(err.message)); }, [session.token]);
  return <section className="all-projects-view"><div className="all-projects-heading"><div><span className="eyebrow">WORKSPACE</span><h1>Team management</h1><p>Registered users and their workspace roles.</p></div><span className="member-count"><Users size={16} /> {users.length} people</span></div>{error && <div className="page-error">{error}</div>}<div className="team-list">{users.map(user => <article className="member-row" key={user._id}><Avatar name={user.name} /><div><strong>{user.name}</strong><span>{user.email}</span></div><span className="owner-tag">{user.role}</span></article>)}</div></section>;
}
