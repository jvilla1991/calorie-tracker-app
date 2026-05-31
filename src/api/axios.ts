import axios from 'axios'

// In dev: Vite proxies /api → localhost:8081 (see vite.config.ts).
// In prod: set VITE_API_BASE_URL to the App Runner service URL so requests go
// directly to the API (e.g. https://xyz.us-east-1.awsapprunner.com/api).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/api`
    : '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ct_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ct_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
