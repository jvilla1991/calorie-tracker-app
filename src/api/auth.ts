import api from './axios'

export async function login(username: string, password: string): Promise<string> {
  const res = await api.post<{ token: string }>('/auth/login', { username, password })
  return res.data.token
}
