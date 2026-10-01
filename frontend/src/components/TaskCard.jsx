import { ArrowDown, Clock3, MoreHorizontal, Trash2 } from 'lucide-react';
import { TASK_COLUMNS } from '../constants.js';
import Avatar from './Avatar.jsx';

function formatDate(value) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value));
}

export default function TaskCard({ task, onEdit, onDetails, onDelete, onStatus, canManage = true }) {
  return (
    <article className="task-card">
      <div className="card-top">
        <span className={`priority ${task.priority}`}><span /> {task.priority}</span>
        {canManage && <button className="icon-button tiny" title="Edit task" onClick={() => onEdit(task)}><MoreHorizontal size={18} /></button>}
      </div>
      <button className="task-title" onClick={() => onDetails(task)}>{task.title}</button>
      {task.dueDate && <p className="task-description">Due {formatDate(task.dueDate)}</p>}
      <div className="task-meta">
        <span className="task-date"><Clock3 size={13} />{formatDate(task.updatedAt || task.createdAt)}</span>
        <Avatar name={task.assignee?.name || task.createdBy?.name || 'You'} />
      </div>
      <div className="card-actions">
        {TASK_COLUMNS.filter(column => column.id !== task.status).map(column => (
          <button key={column.id} title={`Move to ${column.title}`} onClick={() => onStatus(task, column.id)}>
            <ArrowDown size={13} />{column.title}
          </button>
        ))}
        {canManage && <button className="delete-action" title="Delete task" onClick={() => onDelete(task)}><Trash2 size={14} /></button>}
      </div>
    </article>
  );
}
