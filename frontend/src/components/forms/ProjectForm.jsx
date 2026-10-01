import { ErrorMessage, Field, Form, Formik } from 'formik';
import * as Yup from 'yup';

const schema = Yup.object({
  name: Yup.string().trim().min(1, 'Project name is required').max(100).required('Project name is required'),
  description: Yup.string().max(1000, 'Description must be 1000 characters or fewer'),
  startDate: Yup.string().required('Start date is required'),
  dueDate: Yup.string().required('Deadline is required').test('after-start', 'Deadline must be on or after start date', function (value) {
    return !value || !this.parent.startDate || value >= this.parent.startDate;
  })
});

const dateInput = value => value ? new Date(value).toISOString().slice(0, 10) : '';
const datePayload = (value, endOfDay = false) => new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}.000Z`).toISOString();

export default function ProjectForm({ project, users = [], usersLoading = false, usersError = '', onRetryUsers, onSubmit }) {
  return (
    <Formik
      initialValues={{
        name: project?.name || '',
        description: project?.description || '',
        startDate: dateInput(project?.startDate),
        dueDate: dateInput(project?.dueDate),
        members: (project?.members || []).map(member => member._id || member.id)
      }}
      validationSchema={schema}
      validateOnMount
      onSubmit={async (values, helpers) => {
        helpers.setStatus(undefined);
        try {
          await onSubmit({ ...values, startDate: datePayload(values.startDate), dueDate: datePayload(values.dueDate, true) });
        } catch (error) { helpers.setStatus({ message: error.message }); }
      }}
    >
      {({ isSubmitting, isValid, status }) => (
        <Form className="form-stack modal-form">
          <label>Project name<Field name="name" autoFocus maxLength="100" placeholder="e.g. Website refresh" /><FieldError name="name" /></label>
          <label>Description <span className="optional">OPTIONAL</span><Field as="textarea" name="description" rows="3" maxLength="1000" placeholder="What is this project about?" /><FieldError name="description" /></label>
          <div className="form-row">
            <label>Start date<Field type="date" name="startDate" /><FieldError name="startDate" /></label>
            <label>Deadline<Field type="date" name="dueDate" /><FieldError name="dueDate" /></label>
          </div>
          <label>Assign users<Field as="select" name="members" multiple size={Math.max(2, Math.min(users.length || 2, 5))} disabled={usersLoading || Boolean(usersError)}>{users.map(user => <option key={user._id} value={user._id}>{user.name} · {user.email}</option>)}</Field>
            {usersLoading && <small>Loading registered users…</small>}
            {usersError && <small className="field-error">{usersError} {onRetryUsers && <button type="button" className="text-button" onClick={onRetryUsers}>Retry</button>}</small>}
            {!usersLoading && !usersError && users.length === 0 && <small>No registered users to assign yet.</small>}
            {users.length > 0 && <small>Hold Ctrl (Windows) or Command (Mac) to select multiple users.</small>}
          </label>
          {status?.message && <div className="form-error">{status.message}</div>}
          <div className="modal-actions"><button type="button" className="secondary" onClick={() => onSubmit(null)}>Cancel</button><button className="primary" disabled={isSubmitting || !isValid || usersLoading || Boolean(usersError)}>{isSubmitting ? 'Saving…' : project ? 'Save project' : 'Create project'}</button></div>
        </Form>
      )}
    </Formik>
  );
}

function FieldError({ name }) {
  return <ErrorMessage name={name}>{message => <small className="field-error">{message}</small>}</ErrorMessage>;
}
