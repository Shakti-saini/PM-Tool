import { useState } from 'react';
import { Paperclip, Send } from 'lucide-react';
import Avatar from './Avatar.jsx';

export default function TaskDetails({ task, onComment, onClose }) {
  const [body, setBody] = useState('');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    try { await onComment(body, files); setBody(''); setFiles([]); setError(''); }
    catch (requestError) { setError(requestError.message); }
  }
  async function readFiles(list) {
    const selected = [...list].slice(0, 3);
    const results = await Promise.all(selected.map(file => new Promise((resolve, reject) => {
      if (file.size > 900000) return reject(new Error('Each file must be smaller than 900 KB.'));
      if (!['application/pdf', 'text/plain', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) return reject(new Error(`${file.name} has an unsupported file type.`));
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result });
      reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      reader.readAsDataURL(file);
    })));
    setFiles(results);
  }
  return <div className="task-details"><div className="task-detail-summary"><span className={`priority ${task.priority}`}><span />{task.priority} priority</span><p>{task.description || 'No task description.'}</p><div className="task-detail-meta">Assigned to {task.assignee?.name || 'Unassigned'} · Due {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No deadline'}</div></div><h3>Comments and updates</h3><div className="comment-list">{(task.comments || []).map(comment => <article className="comment-item" key={comment._id}><Avatar name={comment.author?.name || 'Teammate'} /><div><strong>{comment.author?.name || 'Teammate'} <small>{new Date(comment.createdAt).toLocaleString()}</small></strong><p>{comment.body}</p>{comment.attachments?.map((file, index) => <a className="attachment-link" href={file.data} download={file.name} key={`${file.name}-${index}`}><Paperclip size={13} />{file.name}</a>)}</div></article>)}</div><form className="comment-form" onSubmit={submit}><textarea value={body} onChange={event => setBody(event.target.value)} maxLength={2000} placeholder="Write an update…" /><div className="comment-actions"><label className="secondary small"><Paperclip size={14} /> Attach<input type="file" multiple hidden onChange={event => readFiles(event.target.files).catch(err => setError(err.message))} /></label><span>{files.length} attachment(s)</span><button className="primary small" disabled={!body.trim() && !files.length}><Send size={13} /> Send</button></div>{error && <div className="form-error">{error}</div>}</form><div className="modal-actions"><button className="secondary" onClick={onClose}>Close</button></div></div>;
}
