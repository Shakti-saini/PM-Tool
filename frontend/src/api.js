const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export async function request(path, { token, ...options } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
    });
  } catch { throw new ApiError('Cannot reach the server. Check your connection and try again.', 0); }
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload.error || 'Something went wrong.', response.status);
  return payload;
}

export const api = {
  me: token => request('/auth/me', { token }),
  login: values => request('/auth/login', { method: 'POST', body: JSON.stringify(values) }),
  register: values => request('/auth/register', { method: 'POST', body: JSON.stringify(values) }),
  projects: token => request('/projects', { token }),
  project: (token, id) => request(`/projects/${id}`, { token }),
  createProject: (token, values) => request('/projects', { token, method: 'POST', body: JSON.stringify(values) }),
  updateProject: (token, id, values) => request(`/projects/${id}`, { token, method: 'PATCH', body: JSON.stringify(values) }),
  deleteProject: (token, id) => request(`/projects/${id}`, { token, method: 'DELETE' }),
  inviteMember: (token, id, email) => request(`/projects/${id}/members`, { token, method: 'POST', body: JSON.stringify({ email }) }),
  removeMember: (token, id, userId) => request(`/projects/${id}/members/${userId}`, { token, method: 'DELETE' }),
  tasks: (token, projectId) => request(`/projects/${projectId}/tasks`, { token }),
  workspaceTasks: token => request('/tasks', { token }),
  createTask: (token, projectId, values) => request(`/projects/${projectId}/tasks`, { token, method: 'POST', body: JSON.stringify(values) }),
  updateTask: (token, projectId, taskId, values) => request(`/projects/${projectId}/tasks/${taskId}`, { token, method: 'PATCH', body: JSON.stringify(values) }),
  updateStatus: (token, projectId, taskId, status) => request(`/projects/${projectId}/tasks/${taskId}/status`, { token, method: 'PATCH', body: JSON.stringify({ status }) }),
  deleteTask: (token, projectId, taskId) => request(`/projects/${projectId}/tasks/${taskId}`, { token, method: 'DELETE' })
  ,users: token => request('/users', { token })
  ,notifications: token => request('/notifications', { token })
  ,markNotificationRead: (token, id) => request(`/notifications/${id}/read`, { token, method: 'PATCH' })
  ,markAllNotificationsRead: token => request('/notifications/read-all', { token, method: 'PATCH' })
  ,addComment: (token, projectId, taskId, body, attachments) => request(`/projects/${projectId}/tasks/${taskId}/comments`, { token, method: 'POST', body: JSON.stringify({ body, attachments }) })
};
