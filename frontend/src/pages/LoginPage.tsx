import { useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import { useAuth } from '../hooks/useAuth';
import AuthLayout from '../components/templates/AuthLayout/AuthLayout';
import LoginForm from '../components/organisms/LoginForm/LoginForm';

export default function LoginPage() {
  const { setToken } = useAuth();
  const navigate = useNavigate();

  async function handleLogin(email: string, password: string) {
    const { token } = await login(email, password);
    setToken(token);
    navigate('/');
  }

  return (
    <AuthLayout subtitle="NFS-e Issuer System">
      <LoginForm onSubmit={handleLogin} />
    </AuthLayout>
  );
}
