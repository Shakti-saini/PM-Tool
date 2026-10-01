import { ErrorMessage, Field, Form, Formik } from 'formik';
import * as Yup from 'yup';
import { X } from 'lucide-react';
import Avatar from '../Avatar.jsx';

const schema = Yup.object({ email: Yup.string().trim().email('Enter a valid email address').required('Email is required') });

export default function MembersForm({ project, user, onInvite, onRemove, onClose }) {
  const members = project.members || [];
  const ownerId = project.owner?._id || project.owner;
  const isOwner = ownerId === user.id || ownerId === user._id;

  return (
    <div className="members-form">
      <p className="member-intro">Everyone in this project sees task changes as they happen. Invite someone who already has an orbit account.</p>
      <Formik initialValues={{ email: '' }} validationSchema={schema} validateOnMount onSubmit={async (values, helpers) => {
        helpers.setStatus(undefined);
        try { await onInvite(values.email); helpers.resetForm(); }
        catch (error) { helpers.setStatus({ message: error.message }); }
      }}>
        {({ isSubmitting, isValid, status }) => (
          <Form>
            <div className="invite-row"><Field type="email" name="email" placeholder="teammate@company.com" disabled={!isOwner || isSubmitting} /><button className="primary" disabled={!isOwner || isSubmitting || !isValid}>Invite</button></div>
            <ErrorMessage name="email">{message => <small className="field-error">{message}</small>}</ErrorMessage>
            {status?.message && <div className="form-error members-error">{status.message}</div>}
          </Form>
        )}
      </Formik>
      <div className="member-list-head">PROJECT MEMBERS <span>{members.length}</span></div>
      <div className="member-list">
        {members.map(member => {
          const memberId = member._id || member.id;
          return <div className="member-row" key={memberId}><Avatar name={member.name} /><div><strong>{member.name}</strong><span>{member.email}</span></div>{memberId === ownerId ? <span className="owner-tag">OWNER</span> : <button className="icon-button tiny" title={`Remove ${member.name}`} disabled={!isOwner} onClick={() => onRemove(member)}><X size={15} /></button>}</div>;
        })}
      </div>
      {!isOwner && <p className="member-note">Only the project owner can invite or remove members.</p>}
      <div className="modal-actions"><button className="secondary" onClick={onClose}>Done</button></div>
    </div>
  );
}
