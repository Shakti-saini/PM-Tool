import { useState } from 'react';
import TaskForm from './TaskForm.jsx';

export default function DashboardTaskForm({ projects, onSubmit }) {
  const [projectId, setProjectId] = useState(projects[0]?._id || '');
  const project = projects.find(item => item._id === projectId);

  return (
    <div className="form-stack modal-form">
      <label>Project<FieldSelect projects={projects} value={projectId} onChange={setProjectId} /></label>
      {project
        ? <TaskForm key={projectId} members={project.members || []} onSubmit={values => onSubmit(projectId, values)} />
        : <p className="form-error">Create a project and assign users before creating a task.</p>}
    </div>
  );
}

function FieldSelect({ projects, value, onChange }) {
  return <select value={value} onChange={event => onChange(event.target.value)}>{projects.map(project => <option key={project._id} value={project._id}>{project.name}</option>)}</select>;
}
