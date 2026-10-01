import { useState } from 'react';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import * as Yup from 'yup';
import { Command, Sparkles } from 'lucide-react';

const loginSchema = Yup.object({
  email: Yup.string().trim().email('Enter a valid email address').required('Email is required'),
  password: Yup.string().required('Password is required')
});

const registerSchema = Yup.object({
  name: Yup.string().trim().max(80).required('Your name is required'),
  email: Yup.string().trim().email('Enter a valid email address').required('Email is required'),
  password: Yup.string().min(8, 'Use at least 8 characters').max(128).required('Password is required')
});

export default function AuthForm({ onSubmit }) {
  const [registering, setRegistering] = useState(false);
  return (
    <Formik
      key={registering ? 'register' : 'login'}
      initialValues={{ name: '', email: '', password: '' }}
      validationSchema={registering ? registerSchema : loginSchema}
      validateOnMount
      onSubmit={async (values, helpers) => {
        helpers.setStatus(undefined);
        try { await onSubmit(values, registering); }
        catch (error) { helpers.setStatus({ message: error.message }); }
      }}
    >
      {({ isSubmitting, isValid, status }) => {
        function toggleMode() {
          setRegistering(current => !current);
        }
        return (
          <main className="auth-layout">
            <div className="auth-art">
              <div className="brand"><span className="brand-mark"><Command size={18} /></span>orbit<span className="brand-dot">.</span></div>
              <div className="art-copy"><span className="pill"><Sparkles size={13} /> A calmer way to work</span><h1>Great work<br />happens <em>together.</em></h1><p>Bring your projects, people, and progress into one clear space.</p></div>
              <div className="art-footer">Made for teams that make things happen <span>✳</span></div>
            </div>
            <div className="auth-panel">
              <div className="auth-form-wrap">
                <span className="eyebrow">YOUR WORKSPACE AWAITS</span>
                <h2>{registering ? 'Create your account' : 'Welcome back'}</h2>
                <p>{registering ? 'Start organizing your team’s best work.' : 'Pick up right where your team left off.'}</p>
                <Form className="form-stack">
                  {registering && <label>Your name<Field name="name" autoComplete="name" placeholder="Jamie Rivera" /><FieldError name="name" /></label>}
                  <label>Work email<Field name="email" type="email" autoComplete="email" placeholder="you@company.com" /><FieldError name="email" /></label>
                  <label>Password<Field name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} placeholder="••••••••••••" />{registering && <small>Use at least 8 characters.</small>}<FieldError name="password" /></label>
                  {status?.message && <div className="form-error">{status.message}</div>}
                  <button className="primary full" disabled={isSubmitting || !isValid}>{isSubmitting ? 'Please wait…' : registering ? 'Create account' : 'Sign in'} <span>↗</span></button>
                </Form>
                <div className="auth-switch">{registering ? 'Already have an account?' : 'New to orbit?'} <button type="button" onClick={toggleMode}>{registering ? 'Sign in' : 'Create an account'}</button></div>
                <div className="auth-note"><span>⌘</span> &nbsp;Your team, all on the same page.</div>
              </div>
              <footer className="auth-bottom"><span>© Orbit workspace</span><span>Privacy &nbsp; · &nbsp; Terms</span></footer>
            </div>
          </main>
        );
      }}
    </Formik>
  );
}

function FieldError({ name }) {
  return <ErrorMessage name={name}>{message => <small className="field-error">{message}</small>}</ErrorMessage>;
}
