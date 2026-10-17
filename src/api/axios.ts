import axios from 'axios'

// In dev: Vite proxies /api → localhost:8081 (see vite.config.ts).
// In prod: set VITE_API_BASE_URL to the App Runner service URL so requests go
// directly to the API (e.g. https://xyz.us-east-1.awsapprunner.com/api).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/api`
    : '/api',
})

/**
 * A path the API hands out (e.g. `/api/photos/12/thumb`) as a URL the browser can load
 * directly, e.g. in `<img src>`: same host as the requests above (proxied in dev).
 */
export function apiUrl(path: string): string {
  if (/^(https?:|blob:|data:)/i.test(path)) return path
  const base = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')
  return base + path
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ct_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** The login call itself — a 401 there means "wrong password", not "session expired". */
const isLoginRequest = (url?: string) => !!url && url.split('?')[0].replace(/\/+$/, '').endsWith('/auth/login')

/** Did this request go out with a token? (Signed-out reads are sent without one.) */
const sentWithToken = (config?: { headers?: unknown }) =>
  !!(config?.headers as Record<string, unknown> | undefined)?.Authorization

// A 401 on a request that carried a token means it expired or was revoked: drop it
// and send the user to sign in again (the full page load also resets cached data).
// Without a token a 401 just fails that request — the read-only view stays put.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && sentWithToken(err.config) && !isLoginRequest(err.config?.url)) {
      localStorage.removeItem('ct_token')
      if (window.location.pathname !== '/login') window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
