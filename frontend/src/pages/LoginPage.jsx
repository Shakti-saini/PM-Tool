import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthForm from '../components/forms/AuthForm.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { PROJECTS_PATH } from '../constants.js';

export default function LoginPage() {
  const { session, signIn, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (session) return <Navigate to={PROJECTS_PATH} replace />;

  async function authenticate(values, registering) {
    if (registering) await register(values);
    else await signIn(values);
    navigate(location.state?.from || PROJECTS_PATH, { replace: true });
  }

  return <AuthForm onSubmit={authenticate} />;
}
