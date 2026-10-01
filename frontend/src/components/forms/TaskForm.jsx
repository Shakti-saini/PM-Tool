import { ErrorMessage, Field, Form, Formik } from 'formik';
import * as Yup from 'yup';
import { TASK_COLUMNS, TASK_PRIORITIES } from '../../constants.js';

const schema = Yup.object({
  title: Yup.string().trim().min(1, 'Task name is required').max(160).required('Task name is required'),
  description: Yup.string().max(2000, 'Details must be 2000 characters or fewer'),
  priority: Yup.string().oneOf(TASK_PRIORITIES).required(),
  status: Yup.string().oneOf(TASK_COLUMNS.map(column => column.id)).required(),
  assignee: Yup.string().nullable(),
  dueDate: Yup.string().required('Task deadline is required')
});

export default function TaskForm({ task, status: initialStatus, members, onSubmit }) {
  return (
    <Formik
      initialValues={{
        title: task?.title || '',
        description: task?.description || '',
        priority: task?.priority || 'medium',
        status: task?.status || initialStatus || 'todo',
        assignee: task?.assignee?._id || task?.assignee?.id || '',
        dueDate: task?.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ''
      }}
      validationSchema={schema}
      validateOnMount
      onSubmit={async (values, helpers) => {
        helpers.setStatus(undefined);
        try { await onSubmit({ ...values, assignee: values.assignee || null, dueDate: values.dueDate ? new Date(`${values.dueDate}T23:59:59.000Z`).toISOString() : null }); }
        catch (error) { helpers.setStatus({ message: error.message }); }
      }}
    >
      {({ isSubmitting, isValid, status }) => (
        <Form className="form-stack modal-form">
          <label>Task name<Field name="title" autoFocus maxLength="160" placeholder="e.g. Draft the launch announcement" /><FieldError name="title" /></label>
          <label>Details <span className="optional">OPTIONAL</span><Field as="textarea" name="description" rows="3" maxLength="2000" placeholder="Add a little context for your team…" /><FieldError name="description" /></label>
          <div className="form-row">
            <label>Priority<Field as="select" name="priority">{TASK_PRIORITIES.map(priority => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}</Field></label>
            <label>Status<Field as="select" name="status">{TASK_COLUMNS.map(column => <option key={column.id} value={column.id}>{column.title}</option>)}</Field></label>
          </div>
          <label>Deadline<Field type="date" name="dueDate" /><FieldError name="dueDate" /></label>
          <label>Assignee<Field as="select" name="assignee"><option value="">Unassigned</option>{members.map(member => <option key={member._id || member.id} value={member._id || member.id}>{member.name}</option>)}</Field></label>
          {status?.message && <div className="form-error">{status.message}</div>}
          <div className="modal-actions"><button type="button" className="secondary" onClick={() => onSubmit(null)}>Cancel</button><button className="primary" disabled={isSubmitting || !isValid}>{isSubmitting ? 'Saving…' : task ? 'Save changes' : 'Add task'} <span>↗</span></button></div>
        </Form>
      )}
    </Formik>
  );
}

function FieldError({ name }) {
  return <ErrorMessage name={name}>{message => <small className="field-error">{message}</small>}</ErrorMessage>;
}

