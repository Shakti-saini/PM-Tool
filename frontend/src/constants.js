export const PROJECTS_PATH = '/projects';

export const TASK_COLUMNS = [
  { id: 'todo', title: 'To do', accent: 'violet' },
  { id: 'in-progress', title: 'In progress', accent: 'amber' },
  { id: 'done', title: 'Done', accent: 'green' }
];

export const TASK_PRIORITIES = ['low', 'medium', 'high'];

export const getProjectPath = projectId => `${PROJECTS_PATH}/${projectId}`;
