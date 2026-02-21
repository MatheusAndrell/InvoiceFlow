import api from './client';

export async function login(email: string, password: string): Promise<{ token: string }> {
  const res = await api.post('/auth/login', { email, password });
  return res.data as { token: string };
}
